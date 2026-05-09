import json
import logging
import os
import threading
from service.utils.prompt_manager import PromptManager
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from service.workflow.rag_graph import app as rag_workflow_app

# Langfuse integration
try:
    from langfuse import Langfuse
    langfuse_client = Langfuse(
        public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
        secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
        host=os.getenv("LANGFUSE_BASE_URL")
    )
    LANGFUSE_ENABLED = True
except Exception as e:
    logging.warning(f"Langfuse not available: {e}")
    langfuse_client = None
    LANGFUSE_ENABLED = False

load_dotenv()


# --- Extract Key Factor Workflow Setup ---
try:
    EXTRACT_KB_IDS = json.loads(os.getenv("DEFAULT_CASE_KB_IDS", "[]"))
except Exception:
    raise ValueError("未找到案例知识库配置: DEFAULT_CASE_KB_IDS 解析失败")

# Configure logger level from environment, fallback to APP_LOG_LEVEL or INFO
_log_level_name = os.getenv("APP_LOG_LEVEL", "INFO").upper()
_log_level = getattr(logging, _log_level_name, logging.INFO)

logger = logging.getLogger(__name__)
logger.setLevel(_log_level)

class RagflowService:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        pass


    async def paragraph_generate_stream(self, request):
        """
        流式生成段落 (Refactored to use LangGraph workflow with streaming)
        """
        if not hasattr(request, 'prompt') or not hasattr(request, 'name'):
            yield {"success": False, "error": "Invalid request object"}
            return

        try:
            query = self._construct_query(request)
            logger.info(f"Generating paragraph for query: {query}")
            
            # 1. Get Prompt from Langfuse
            # Encapsulating this logic here as it's specific to this service's business rule
            try:
                prompt_manager = PromptManager()
                prompt_obj = prompt_manager.get_prompt("construction_agent_system")
                system_prompt = prompt_obj.prompt
            except Exception as e:
                logger.warning(f"Failed to fetch prompt from Langfuse: {e}. Using default.")
                system_prompt = ""

            # 2. Prepare parameters for the workflow
            template = getattr(request, 'template', "")
            
            inputs = {
                "messages": [HumanMessage(content=query)],
                "project_info": "",
                "kb_ids": EXTRACT_KB_IDS,
                "template": template,
                "system_prompt": system_prompt 
            }
            
            # 3. Invoke Workflow with Streaming
            # Use astream with stream_mode="messages" to get token streams from the LLM

            # Note: Langfuse tracing is handled at the workflow level via environment variables
            # No need to pass callbacks here

            async for msg, metadata in rag_workflow_app.astream(
                inputs,
                stream_mode="messages"
            ):
                if msg.content:
                    yield {
                        "success": True,
                        "text": msg.content,
                        "session_id": "workflow-rag-gen",
                        "request_id": "gen-id",
                        "finish_reason": None,
                        "doc_reference": [],
                        "chunk_reference": []
                    }
            
            # Final chunk to signal completion (optional, but good for some clients)
            yield {
                "success": True,
                "text": "",
                "session_id": "workflow-rag-gen",
                "request_id": "gen-id",
                "finish_reason": "stop",
                "doc_reference": [],
                "chunk_reference": []
            }
                
        except Exception as e:
            logger.error("paragraph_generate error: %s", e, exc_info=True)
            yield {"success": False, "error": str(e), "session_id":""}

    async def paragraph_generate(self, request):
        """
        非流式生成段落
        """
        result_text = ""
        last_chunk = {}
        
        async for chunk in self.paragraph_generate_stream(request):
            if chunk.get("success"):
                if chunk.get("text"):
                    result_text += chunk["text"]
                last_chunk = chunk
            else:
                return chunk
        
        if last_chunk:
            last_chunk["text"] = result_text
            last_chunk["finish_reason"] = "stop"
            return last_chunk
        
        return {"success": False, "error": "No response generated"}


    # Helper methods
    def _construct_query(self, request):
        goal = (request.prompt or "").strip()
        doc_name = (request.name or "").strip()
        target_section = (request.chapterName or "").strip()
        outline_text = goal
        prefix = "生成章节，包括 "
        if outline_text.startswith(prefix):
            outline_text = outline_text[len(prefix):].strip()
        compose_prompt = (
            f"【目标】:生成章节-{target_section}\n"
            f"【文档名称】：{doc_name}\n"
        )
        req_text = (getattr(request, "requirement", "") or "").strip()
        if req_text:
            compose_prompt += f"\n【补充要求】:{req_text}"
        return compose_prompt
