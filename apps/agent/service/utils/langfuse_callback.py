"""
Enhanced LangFuse Callback Handler with Accurate Token Counting

This module provides an enhanced LangFuse callback handler that includes
accurate token counting for better cost tracking and pricing accuracy.

Based on the session-document branch implementation with improvements.
"""

import logging
from typing import Dict, Any, Optional, List
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult

try:
    # Try LangFuse 3.x import path
    from langfuse.langchain import CallbackHandler
except ImportError:
    try:
        # Fallback to older import path
        from langfuse.callback import CallbackHandler
    except ImportError:
        # If LangFuse is not available, create a dummy handler
        class CallbackHandler:
            def __init__(self):
                pass
            def on_llm_start(self, *args, **kwargs):
                pass
            def on_llm_end(self, *args, **kwargs):
                pass

# Try to import tiktoken for accurate token counting
try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False

logger = logging.getLogger(__name__)


class QwenTokenCounter:
    """
    Qwen 模型的 Token 计数器
    基于经验公式和 tiktoken 的混合方法
    """
    
    @staticmethod
    def count_tokens(text: str) -> int:
        """计算文本的 token 数量"""
        if not text:
            return 0
        
        # 尝试使用 tiktoken 进行精确计算
        if TIKTOKEN_AVAILABLE:
            try:
                # 使用 cl100k_base 编码（适用于 qwen-max）
                encoding = tiktoken.get_encoding("cl100k_base")
                return len(encoding.encode(text))
            except Exception as e:
                logger.debug(f"tiktoken encoding failed: {e}, falling back to estimation")
        
        # Fallback 到经验公式
        chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
        english_chars = sum(1 for char in text if char.isascii() and char.isalpha())
        english_words = max(1, english_chars // 5)
        punctuation = sum(1 for char in text if not char.isalnum() and not char.isspace())
        
        estimated_tokens = int(
            chinese_chars * 1.2 +
            english_words * 1.3 +
            punctuation * 1.0
        )
        return max(1, estimated_tokens)
    
    @staticmethod
    def count_messages_tokens(messages: List[BaseMessage]) -> int:
        """计算消息列表的总 token 数（包含消息格式开销）"""
        total_tokens = sum(
            QwenTokenCounter.count_tokens(msg.content) + 3
            for msg in messages
            if hasattr(msg, 'content')
        )
        return total_tokens


class EnhancedLangfuseHandler(CallbackHandler):
    """
    增强的 LangFuse callback handler，基于 session-document 分支的实现
    关键特性：直接注入 token 统计到 LLM Response，确保 LangFuse 使用准确数据
    """
    
    def __init__(self, user_id: str, session_id: str, metadata: Dict[str, Any] = None):
        """
        Initialize enhanced LangFuse handler
        
        Args:
            user_id: User identifier
            session_id: Session identifier
            metadata: Additional metadata
        """
        super().__init__()
        
        # Set LangFuse attributes using the SAME method as the original fix
        # This is critical for maintaining session functionality
        self._langfuse_user_id = user_id
        self._langfuse_session_id = session_id
        self._langfuse_metadata = metadata or {}
        self._langfuse_tags = ["construction_agent", "document_generation", "accurate_tokens"]
        
        # Initialize token counter
        self.token_counter = QwenTokenCounter()
        
        # Track token usage per generation (key: run_id)
        self._current_generation_tokens: Dict[str, Dict[str, int]] = {}
        
        # Track total usage for session
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost = 0.0
        
        logger.info(f"Enhanced LangFuse handler initialized for user {user_id}, session {session_id}")
    
    def _store_input_tokens(self, run_id: Any, input_tokens: int) -> None:
        """存储输入 token 统计"""
        self._current_generation_tokens[str(run_id)] = {
            'input_tokens': input_tokens,
            'output_tokens': 0,
            'total_tokens': input_tokens
        }
        self.total_input_tokens += input_tokens
        logger.debug(f"Stored input tokens - run_id: {run_id}, tokens: {input_tokens}")
    
    def _inject_token_usage(self, response: LLMResult, run_id: Any) -> None:
        """
        注入 token 统计到 response - 这是关键！
        LangFuse 会优先使用 response.llm_output['token_usage'] 中的数据
        """
        run_id_str = str(run_id)
        if run_id_str not in self._current_generation_tokens:
            return
        
        if not hasattr(response, 'llm_output') or response.llm_output is None:
            response.llm_output = {}
        
        token_usage = self._current_generation_tokens[run_id_str]
        
        # 注入标准的 OpenAI 格式 token 统计
        response.llm_output['token_usage'] = {
            'prompt_tokens': token_usage['input_tokens'],
            'completion_tokens': token_usage['output_tokens'],
            'total_tokens': token_usage['total_tokens']
        }
        
        # 计算成本并注入
        input_cost = self.calculate_cost(token_usage['input_tokens'], is_input=True)
        output_cost = self.calculate_cost(token_usage['output_tokens'], is_input=False)
        total_cost = input_cost + output_cost
        self.total_cost += total_cost
        
        # 注入成本信息
        response.llm_output['cost'] = {
            'input_cost': input_cost,
            'output_cost': output_cost,
            'total_cost': total_cost,
            'currency': 'USD'
        }
        
        logger.debug(
            f"[Enhanced LangFuse] Injected token usage for run {run_id}: "
            f"input={token_usage['input_tokens']}, output={token_usage['output_tokens']}, "
            f"cost=${total_cost:.6f}"
        )
    
    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], 
                     *, run_id: Any, parent_run_id: Optional[Any] = None,
                     tags: Optional[List[str]] = None, metadata: Optional[Dict[str, Any]] = None,
                     **kwargs: Any) -> None:
        """LLM 开始时的回调"""
        super().on_llm_start(
            serialized, prompts,
            run_id=run_id, parent_run_id=parent_run_id,
            tags=tags, metadata=metadata, **kwargs
        )
        
        # 计算输入 tokens
        input_tokens = sum(self.token_counter.count_tokens(prompt) for prompt in prompts)
        self._store_input_tokens(run_id, input_tokens)
        
        logger.debug(f"[Enhanced LangFuse] LLM start - Input tokens: {input_tokens} (run_id: {run_id})")
    
    def on_llm_end(self, response: LLMResult, *, run_id: Any, 
                   parent_run_id: Optional[Any] = None, **kwargs: Any) -> None:
        """LLM 结束时的回调 - 关键方法！"""
        run_id_str = str(run_id)
        
        # 计算输出 tokens
        output_tokens = 0
        for generation_list in response.generations:
            for generation in generation_list:
                if hasattr(generation, 'text'):
                    output_tokens += self.token_counter.count_tokens(generation.text)
                elif hasattr(generation, 'message') and hasattr(generation.message, 'content'):
                    output_tokens += self.token_counter.count_tokens(generation.message.content)
        
        # 更新统计
        if run_id_str in self._current_generation_tokens:
            self._current_generation_tokens[run_id_str]['output_tokens'] = output_tokens
            self._current_generation_tokens[run_id_str]['total_tokens'] += output_tokens
            self.total_output_tokens += output_tokens
        
        logger.debug(f"[Enhanced LangFuse] LLM end - Output tokens: {output_tokens} (run_id: {run_id})")
        
        # 关键步骤：注入 token 统计到 response
        self._inject_token_usage(response, run_id)
        
        # 调用父类方法
        super().on_llm_end(response, run_id=run_id, parent_run_id=parent_run_id, **kwargs)
        
        # 清理
        if run_id_str in self._current_generation_tokens:
            del self._current_generation_tokens[run_id_str]
    
    def on_chat_model_start(self, serialized: Dict[str, Any], messages: List[List[BaseMessage]],
                           *, run_id: Any, parent_run_id: Optional[Any] = None,
                           tags: Optional[List[str]] = None, metadata: Optional[Dict[str, Any]] = None,
                           **kwargs: Any) -> None:
        """Chat 模型开始时的回调"""
        super().on_chat_model_start(
            serialized, messages,
            run_id=run_id, parent_run_id=parent_run_id,
            tags=tags, metadata=metadata, **kwargs
        )
        
        # 计算输入 tokens（包含消息格式开销）
        input_tokens = sum(
            self.token_counter.count_messages_tokens(msg_list)
            for msg_list in messages
        )
        self._store_input_tokens(run_id, input_tokens)
        
        logger.debug(f"[Enhanced LangFuse] Chat model start - Input tokens: {input_tokens} (run_id: {run_id})")
    
    def calculate_cost(self, tokens: int, is_input: bool = True) -> float:
        """
        Calculate cost based on token count and model
        
        Args:
            tokens: Number of tokens
            is_input: Whether these are input tokens (vs output tokens)
            
        Returns:
            Estimated cost in USD
        """
        # Model pricing (per 1M tokens, 2025年实际定价)
        model_pricing = {
            'qwen-max': {
                'input': 1.60,   # $1.60 per 1M input tokens (实际定价)
                'output': 6.40,  # $6.40 per 1M output tokens (实际定价)
            },
            'qwen-plus': {
                'input': 0.40,   # $0.40 per 1M input tokens
                'output': 1.20,  # $1.20 per 1M output tokens
            },
            'qwen-turbo': {
                'input': 0.05,   # $0.05 per 1M input tokens
                'output': 0.20,  # $0.20 per 1M output tokens
            },
            'gpt-4': {
                'input': 30.0,   # $30 per 1M input tokens
                'output': 60.0,  # $60 per 1M output tokens
            },
            'gpt-4-turbo': {
                'input': 10.0,   # $10 per 1M input tokens
                'output': 30.0,  # $30 per 1M output tokens
            },
            'claude-3-opus': {
                'input': 15.0,   # $15 per 1M input tokens
                'output': 75.0,  # $75 per 1M output tokens
            },
            'claude-3-sonnet': {
                'input': 3.0,    # $3 per 1M input tokens
                'output': 15.0,  # $15 per 1M output tokens
            },
        }
        
        # 默认使用 qwen-max 定价
        pricing = model_pricing.get('qwen-max', {'input': 1.60, 'output': 6.40})
        
        rate = pricing['input'] if is_input else pricing['output']
        cost = (tokens / 1_000_000) * rate
        
        return cost
    
    def get_usage_summary(self) -> Dict[str, Any]:
        """
        Get usage summary for this session
        
        Returns:
            Dictionary with usage statistics
        """
        return {
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens,
            "total_estimated_cost_usd": self.total_cost,
            "user_id": self._langfuse_user_id,
            "session_id": self._langfuse_session_id,
        }


def create_enhanced_langfuse_handler(user_id: str, session_id: str, 
                                   metadata: Dict[str, Any] = None) -> EnhancedLangfuseHandler:
    """
    Create an enhanced LangFuse handler with accurate token counting
    
    Args:
        user_id: User identifier
        session_id: Session identifier  
        metadata: Additional metadata
        
    Returns:
        Enhanced LangFuse handler instance
    """
    return EnhancedLangfuseHandler(user_id, session_id, metadata)


def get_langfuse_metadata(user_id: str, session_id: str, 
                         metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Get LangFuse metadata for LangChain integration
    保持与原有 session 修复逻辑的兼容性
    
    Args:
        user_id: User identifier
        session_id: Session identifier
        metadata: Additional metadata
        
    Returns:
        Metadata dictionary for LangChain
    """
    # 使用与原有 session 修复相同的特殊键名
    return {
        "langfuse_user_id": user_id,           # 特殊键：会被解析为 user_id
        "langfuse_session_id": session_id,     # 特殊键：会被解析为 session_id
        "langfuse_tags": ["construction_agent", "document_generation", "accurate_tokens"],  # 特殊键：会被解析为 tags
        # 其他自定义 metadata
        "user_id": user_id,                    # 保留用于显示
        "session_id": session_id,              # 保留用于显示
        **(metadata or {})
    }