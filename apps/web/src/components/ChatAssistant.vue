<script setup lang="ts">
import { ref, nextTick, computed, onBeforeUnmount, watch, onMounted } from 'vue';
import { ElMessage, ElIcon } from 'element-plus';
import {
  Promotion as Send,
  Loading as Loader2,
  ArrowRight as ChevronRight,
  CircleCheck as CheckCircle2,
  CircleClose as XCircle,
  Warning as AlertCircle,
  User,
  MagicStick as Sparkles,
  Check,
  Warning as AlertTriangle,
  ArrowDown,
  ArrowUp,
  QuestionFilled,
  Document,
  Folder,
  EditPen,
  Setting,
  Close,
  View,
  Coin
} from '@element-plus/icons-vue';
import MarkdownRenderer from './MarkdownRenderer.vue';
import { workflowChatStream } from '../service/workflow';
import { getDocumentTemplates, searchTemplateChapter } from '../service/template';
import { getChapterTemplate } from '../utils/chapter';
import { authStorage } from '../utils/auth';
import { PROJECT_FIELD_MAP } from '../data/constants';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  currentChapter: {
    type: Object,
    default: null
  },
  currentChapterId: {
    type: String,
    default: ''
  },
  documentTitle: {
    type: String,
    default: ''
  },
  projectId: {
    type: String,
    default: ''
  },
  // 项目信息（可选，从 Editor.vue 传递）
  projectInfo: {
    type: Object,
    default: null
  },
  width: {
    type: Number,
    default: 380
  }
});

// Emits
const emit = defineEmits(['update:visible', 'content-generated', 'content-streaming', 'resize', 'resize-start', 'resize-end', 'generation-stopped', 'update:enableCitation']);

// Resize logic
const isResizing = ref(false);

const startResize = (e) => {
  e.preventDefault();
  isResizing.value = true;
  emit('resize-start');
  const startX = e.clientX;
  const startWidth = props.width;
  
  const handleMouseMove = (moveEvent) => {
    if (!isResizing.value) return;
    const deltaX = startX - moveEvent.clientX;
    const newWidth = startWidth + deltaX;
    emit('resize', newWidth);
  };
  
  const handleMouseUp = () => {
    isResizing.value = false;
    emit('resize-end');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

// 表单面板状态
const formPanelExpanded = ref(true);
const projectInfoText = ref('');
const chapterTemplateText = ref('');
const additionalRequirements = ref('');
const isGenerating = ref(false);
const enableAudit = ref(false); // 是否启用校验
const enableCitation = ref(false); // 是否在正文中显示引用标记

// 引用标记开关变化时通知父组件
watch(enableCitation, (val) => {
  emit('update:enableCitation', val);
}, { immediate: true });

// 模板相关状态
const documentTemplates = ref([]);
const selectedTemplateId = ref(null);
const matchStatus = ref('none'); // 'success' | 'default' | 'none' | 'manual'
const isMatchingTemplate = ref(false);
const isAutoMatchEnabled = ref(false);
const userInfo = computed(() => authStorage.getUserInfo());
const templatePreviewVisible = ref(false);
const templatePreviewContent = ref('');
const templatePreviewDescription = ref('');
const templatePreviewTitle = ref('');

const messages = ref([]);
const messagesContainer = ref(null);
const abortController = ref(null);

// 维护 stepId 到步骤索引的映射，用于合并相邻同名节点
const stepIdToIndex = ref(new Map());

// ========================================
// 数据转换函数
// ========================================

// 项目概况字段映射
const fieldMap = PROJECT_FIELD_MAP;


// 对象转文本（键值对格式）
const projectInfoToText = (projectInfo) => {
  if (!projectInfo) return '';
  return Object.entries(fieldMap)
    .map(([key, label]) => {
      const value = projectInfo[key];
      return value ? `${label}: ${value}` : null;
    })
    .filter(Boolean)
    .join('\n');
};


// 格式化内容为字符串
const formatContentToString = (content) => {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch (e) {
    return String(content);
  }
};

// 自动匹配最合适的模板
const matchTemplate = async () => {
  matchStatus.value = 'none';
  if (!props.currentChapter || documentTemplates.value.length === 0) {
    console.log('[模板匹配] 跳过匹配: currentChapter=', props.currentChapter, ', 模板数量=', documentTemplates.value.length);
    return;
  }

  console.log('[模板匹配] 开始匹配, 当前章节:', props.currentChapter.title);
  isMatchingTemplate.value = true;

  // Mock 数据回退 (已禁用，保留作为备用)
  /*
  const mockContent = getChapterTemplate(props.currentChapter.title);
  if (mockContent) {
    chapterTemplateText.value = mockContent;
    // 选中项置空，因为是 Mock 数据
    selectedTemplateId.value = null;
    matchStatus.value = 'default';
  }
  */

  // 智能匹配 API 调用
  try {
    const user = userInfo.value;
    if (!user?.id) {
      console.warn('[模板匹配] 用户未登录，无法进行智能匹配');
      throw new Error('用户未登录');
    }

    console.log('[模板匹配] 调用 API, 参数:', {
      userId: String(user.id),
      chapterTitle: props.currentChapter.title,
      professionTagId: props.projectInfo?.professionTagId,
      businessTypeTagId: props.projectInfo?.businessTypeTagId,
      threshold: 0.5,
      limit: 3
    });

    // 调用模板检索接口
    const result = await searchTemplateChapter({
      userId: String(user.id),
      chapterTitle: props.currentChapter.title,
      professionTagId: props.projectInfo?.professionTagId,
      businessTypeTagId: props.projectInfo?.businessTypeTagId,
      threshold: 0.5,
      limit: 3
    });

    console.log('[模板匹配] API 响应:', result);
    console.log('[模板匹配] API 响应详细信息:', {
      code: result.code,
      message: result.message,
      hasData: !!result.data,
      matched: result.data?.matched,
      alternativesCount: result.data?.alternatives?.length || 0
    });

    if (result.code === 200 && result.data?.matched) {
      const matched = result.data.matched;

      console.log('[模板匹配] 匹配成功:', {
        templateId: matched.templateId,
        templateName: matched.templateName,
        chapterTitle: matched.chapterTitle,
        similarity: matched.similarity,
        matchType: matched.matchType,
        contentLength: matched.chunkContent?.length || 0
      });

      // 设置选中的模板
      selectedTemplateId.value = matched.templateId;

      // 设置章节内容 (使用匹配到的 chunk 内容)
      chapterTemplateText.value = matched.chunkContent;

      // 更新匹配状态
      matchStatus.value = 'success';

      // 输出备选项信息
      if (result.data.alternatives && result.data.alternatives.length > 0) {
        console.log('[模板匹配] 备选项:', result.data.alternatives.map(alt => ({
          templateName: alt.templateName,
          similarity: alt.similarity,
          chapterTitle: alt.chapterTitle
        })));
      }
    } else {
      console.log('[模板匹配] 未找到匹配结果');
      console.log('[模板匹配] 未匹配原因分析:', {
        codeIs200: result.code === 200,
        hasData: !!result.data,
        hasMatched: !!result.data?.matched,
        alternativesCount: result.data?.alternatives?.length || 0,
        possibleReason: !result.data?.matched ? 'API返回matched为null，可能是知识库无数据或检索未命中' : '其他原因'
      });
      console.warn('[模板匹配] 回退到 Mock 数据');
      // 回退到 Mock 数据
      const mockContent = getChapterTemplate(props.currentChapter.title);
      if (mockContent) {
        chapterTemplateText.value = mockContent;
        selectedTemplateId.value = null;
        matchStatus.value = 'default';
        console.log('[模板匹配] 使用 Mock 数据, 内容长度:', mockContent.length);
      } else {
        console.log('[模板匹配] Mock 数据也不存在');
      }
    }
  } catch (error) {
    console.error('[模板匹配] 匹配失败:', error);
    // 失败时回退到 Mock 数据
    const mockContent = getChapterTemplate(props.currentChapter.title);
    if (mockContent) {
      chapterTemplateText.value = mockContent;
      selectedTemplateId.value = null;
      matchStatus.value = 'default';
      console.log('[模板匹配] 错误回退: 使用 Mock 数据');
    }
  }

  isMatchingTemplate.value = false;
  console.log('[模板匹配] 匹配结束, 最终状态:', matchStatus.value);
};

// 处理模板选择变更
const handleTemplateChange = async (val) => {
  if (!val) {
    // 清除选择，恢复 Mock
    const mockContent = getChapterTemplate(props.currentChapter?.title);
    chapterTemplateText.value = formatContentToString(mockContent);
    matchStatus.value = 'default';
    return;
  }

  matchStatus.value = 'manual';
  const template = documentTemplates.value.find(t => t.id === val);
  if (!template) return;

  // 尝试通过智能检索获取该模板中对应章节的内容
  try {
    const user = userInfo.value;
    if (user?.id && props.currentChapter?.title) {
      const result = await searchTemplateChapter({
        userId: String(user.id),
        chapterTitle: props.currentChapter.title,
        professionTagId: props.projectInfo?.professionTagId,
        businessTypeTagId: props.projectInfo?.businessTypeTagId,
        threshold: 0.3,
        limit: 15
      });

      if (result.code === 200 && result.data?.matched) {
        // 优先查找与所选模板匹配的结果
        const matched = result.data.matched;
        if (matched.templateId === val) {
          chapterTemplateText.value = matched.chunkContent;
          return;
        }
        // 在备选项中查找所选模板
        const alternatives = result.data.alternatives || [];
        const alt = alternatives.find(a => a.templateId === val);
        if (alt) {
          chapterTemplateText.value = alt.chunkContent;
          return;
        }
      }
    }
  } catch (error) {
    console.error('检索模板章节失败，回退到全文:', error);
  }

  // 回退：使用模板全文内容
  if (template.content && props.currentChapter) {
    chapterTemplateText.value = formatContentToString(template.content);
  } else {
    ElMessage.warning('模板中未找到对应的内容');
  }
};

// 加载模板列表
const loadTemplates = async () => {
  const user = userInfo.value;
  if (!user?.id) return;
  
  try {
    const res = await getDocumentTemplates(user.id);
    if (res.code === 200 && res.data) {
      documentTemplates.value = res.data;
      // TODO-加载完成后尝试自动匹配
      if (isAutoMatchEnabled.value) {
        matchTemplate();
      }
    }
  } catch (e) {
    console.error('加载模板失败', e);
  }
};

// 预览模板
const openTemplatePreview = () => {
  if (!selectedTemplateId.value) {
    ElMessage.warning('请先选择一个模板');
    return;
  }
  
  const template = documentTemplates.value.find(t => t.id === selectedTemplateId.value);
  if (!template) return;
  
  templatePreviewTitle.value = template.name;
  templatePreviewDescription.value = template.description || '无';
  
  // 构造预览内容：显示当前章节的内容（如果有）
  let previewMd = '';
  
  // TODO 根据所选模板，提取章节内容
  // if (template.content) {  
  //   // 如果当前文本域有内容，也展示出来对比
  //   if (chapterTemplateText.value) {
  //     const text = String(chapterTemplateText.value);
  //     previewMd = `\`\`\`text\n${text}\n\`\`\``;
  //   }else {
  //     previewMd = `无法解析结构化数据，预览暂不可用。`;
  //   }
    
  // }
  const text = String(chapterTemplateText.value);
  previewMd = `\`\`\`text\n${text}\n\`\`\``;
  templatePreviewContent.value = previewMd;
  //  console.log('2222222222222 template preview content:', templatePreviewContent.value, template.content)
  templatePreviewVisible.value = true;
};

// ========================================
// 监听器：自动初始化表单
// ========================================

// 监听自动匹配开关，开启时立即尝试匹配
watch(isAutoMatchEnabled, (val) => {
  if (val) {
    matchTemplate();
  }
});

// 监听章节变化，自动加载模板
watch(() => props.currentChapter, (newChapter) => {
  // 切换章节时，重置模板相关状态
  selectedTemplateId.value = null;
  chapterTemplateText.value = '';
  matchStatus.value = 'none';
  isMatchingTemplate.value = false;

  if (newChapter?.id) {
    // 章节切换时，尝试重新匹配
    // 注意：如果用户之前已经手动选择了某个模板且不想变，这里可能会覆盖。
    // 但通常切换章节意味着上下文变了，应该重新匹配。
    if (documentTemplates.value.length > 0 && isAutoMatchEnabled.value) {
      matchTemplate();
    } else {
      // 还没加载完模板，或者没有模板，使用 Mock
      chapterTemplateText.value = getChapterTemplate(newChapter.title);
    }
  }
}, { immediate: true });

onMounted(() => {
  loadTemplates();
});


// 监听项目信息变化，初始化项目概况
watch(() => props.projectInfo, (newProjectInfo) => {
  // 项目信息变化时，重置模板相关状态
  selectedTemplateId.value = null;
  chapterTemplateText.value = '';
  matchStatus.value = 'none';
  isMatchingTemplate.value = false;

  if (newProjectInfo) {
    projectInfoText.value = projectInfoToText(newProjectInfo);
  }
}, { immediate: true });

// ========================================
// 表单验证和生成逻辑
// ========================================

// 表单验证
const canGenerate = computed(() => {
  if(!chapterTemplateText.value){
    return false;
  }
  const templateText = typeof chapterTemplateText.value === 'string' ? chapterTemplateText.value : '';
  return (
    props.currentChapter?.id &&
    projectInfoText.value.trim() &&
    templateText.trim() &&
    !isGenerating.value
  );
});

// 构造生成提示词
const buildGenerationPrompt = () => {
  const parts = [];

  // 基础任务描述
  parts.push(`请根据以下信息生成《${props.currentChapter?.title || ''}》章节的施工图设计说明。`);

  // 补充要求
  if (additionalRequirements.value.trim()) {
    parts.push(`\n【特殊要求】\n${additionalRequirements.value}`);
  }

  // 输出格式要求
  parts.push('\n【输出格式】\n请使用 Markdown 格式输出，符合国家建筑规范标准。');

  return parts.join('\n');
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// 生成章节内容（替换原 sendMessage）
const handleGenerate = async () => {
  if (!canGenerate.value) return;

  // 1. 折叠表单，准备显示生成结果
  formPanelExpanded.value = false;
  messages.value = [];
  stepIdToIndex.value.clear();

  // 2. 创建 assistant 消息占位符
  const assistantMsgId = Date.now().toString();
  const assistantMsg = {
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    steps: [],
    timestamp: Date.now()
  };
  messages.value.push(assistantMsg);
  const reactiveAssistantMsg = messages.value[0];

  isGenerating.value = true;
  scrollToBottom();

  // 3. 创建 AbortController
  if (abortController.value) {
    abortController.value.abort();
  }
  abortController.value = new AbortController();

  try {
    let fullContent = '';
    let chunkReference = [];  // 引用元数据（来自 reference 事件）
    let docAggs = [];  // 引用文档聚合列表（来自 reference 事件）

    // 获取用户信息
    const userInfo = authStorage.getUserInfo();
    const userId = userInfo?.name || userInfo?.email || 'default_user';

    // 4. 调用 workflow API（新增 template 和 project_info 参数）
    await workflowChatStream(
      {
        message: buildGenerationPrompt(),
        project_id: props.projectId,
        document_id: props.projectId,  // 使用 projectId 作为 document_id
        template: chapterTemplateText.value,
        project_info: projectInfoText.value,
        user_id: userId,
        enable_audit: enableAudit.value,  // 传递校验开关状态
        enable_citation: enableCitation.value,  // 传递引用标记开关状态
        chapter_name: props.currentChapter?.title || undefined,
        additional_requirements: additionalRequirements.value.trim() || undefined,
        profession_tag_id: props.projectInfo?.professionTagId,      // 标签：专业
        business_type_tag_id: props.projectInfo?.businessTypeTagId,  // 标签：业态
      },
      (event) => {
        // 复用现有的事件处理逻辑
        handleEvent(reactiveAssistantMsg, event.event, event.data);

        // 累积完整内容并实时发送流式事件
        if (event.event === 'token' && event.data.content) {
          fullContent += event.data.content;

          // 实时发送流式内容到 MarkdownEditor
          emit('content-streaming', fullContent);
        }

        // 补救机制：如果 generate 节点的内容全部在思考链中（无 token 事件），
        // 从 timeline_step 的 thought 字段中提取内容
        if (event.event === 'timeline_step' &&
            event.data.node === 'generate' &&
            event.data.status === 'completed' &&
            event.data.thought &&
            !fullContent) {
          fullContent = event.data.thought;
          emit('content-streaming', fullContent);
        }

        // 接收引用元数据
        if (event.event === 'reference') {
          if (event.data.chunk_reference) {
            chunkReference = event.data.chunk_reference;
          }
          if (event.data.doc_aggs) {
            docAggs = event.data.doc_aggs;
          }
        }
      },
      abortController.value.signal
    );

    // 5. 生成完成后自动应用到编辑器
    if (fullContent) {
      emit('content-generated', fullContent, chunkReference, docAggs);
    }

  } catch (error) {
    console.error('生成失败:', error);
    const isAbort = error?.name === 'AbortError' || String(error).includes('AbortError');
    if (!isAbort) {
      reactiveAssistantMsg.content += `\n\n**错误:** ${error.message}`;
      ElMessage.error('章节生成失败');
    }
  } finally {
    isGenerating.value = false;
    // Ensure no step stays stuck in progress
    reactiveAssistantMsg.steps.forEach(s => {
      if (s.status === 'in_progress') {
        s.status = 'completed';
      }
    });
    scrollToBottom();
  }
};

// 停止生成
const stopGeneration = () => {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
  }
  isGenerating.value = false;
  ElMessage.info('已停止生成');
  emit('generation-stopped');
};

// 辅助函数：检查步骤是否有内容
const hasStepContent = (step) => {
  return (
    (step.toolCalls && step.toolCalls.length > 0) ||
    (step.details && step.details.length > 0) ||
    (step.thought && step.thought.length > 0) ||
    (step.result) ||
    (step.error)
  );
};

// 综合判断并更新步骤状态和展开逻辑
const updateStepStatus = (msg, step) => {
  // 检查是否有任何工具处于非最终状态（不仅仅是 running）
  // 只要有工具未完成，就保持步骤为进行中
  const hasActiveTools = step.toolCalls && step.toolCalls.some(t => 
    !['completed', 'success', 'failed', 'error'].includes(t.status)
  );
  
  if (hasActiveTools) {
    step.status = 'in_progress';
  } else if (step.backendStatus && step.backendStatus !== 'in_progress') {
    step.status = step.backendStatus;
  }

  // 更新展开逻辑
  // 1. 当前是最后一个message
  // 2. 有需要展示的内容
  const isLastMessage = msg === messages.value[messages.value.length - 1];
  const content = hasStepContent(step);
  
  if (isLastMessage && content) {
    step.expanded = true;
  } else {
    step.expanded = false;
  }
};

// 处理工具调用事件
const handleToolCall = (msg, step, data) => {
  if (!step.toolCalls) {
    step.toolCalls = [];
  }

  const existingTool = step.toolCalls.find(t => t.id === data.tool_id);

  if (!existingTool) {
    // 新工具调用 - running 状态
    step.toolCalls.push({
      id: data.tool_id,
      name: data.name,
      displayName: data.display_name,
      args: data.args,
      status: data.status,
      timestamp: data.timestamp
    });

    // 自动添加到 details 显示
    if (data.display_name) {
      const detailText = `🔧 ${data.display_name}`;
      if (!step.details.includes(detailText)) {
        step.details.push(detailText);
      }
    }
  } else {
    // 更新工具状态 - completed 状态
    existingTool.status = data.status;
    if (data.result) {
      existingTool.result = data.result;
      existingTool.duration = data.duration;

      // 更新 details 显示结果
      const detailIndex = step.details.findIndex(d => d.includes(data.display_name || data.name));
      if (detailIndex !== -1) {
        step.details[detailIndex] = `✓ ${data.display_name || data.name}: ${data.result}`;
      }
    }
  }

  // 更新步骤状态
  updateStepStatus(msg, step);
};

// 处理步骤结果事件
const handleStepResult = (msg, step, data) => {
  step.result = {
    type: data.type,
    message: data.message,
    suggestions: data.suggestions,
    metadata: data.metadata
  };

  // 根据结果类型更新状态
  if (data.type === 'pass') {
    step.backendStatus = 'completed';
  } else if (data.type === 'revise') {
    step.backendStatus = 'needs_attention';
  }
  
  updateStepStatus(msg, step);

  // 添加到 details 显示
  const resultEmoji = data.type === 'pass' ? '✅' : '⚠️';
  const detailText = `${resultEmoji} ${data.message}`;
  if (!step.details.includes(detailText)) {
    step.details.push(detailText);
  }
};

// 辅助函数：查找或创建步骤
const findOrCreateStep = (msg, stepId, data) => {
  // 检查该 stepId 是否已经映射到某个步骤
  const mappedIndex = stepIdToIndex.value.get(stepId);
  if (mappedIndex !== undefined) {
    return msg.steps[mappedIndex];
  }

  // 如果没有映射，尝试创建（这种情况理论上不应该发生，因为 timeline_step 应该先到）
  console.warn(`Step ${stepId} not found, this should not happen`);
  return null;
};

const handleEvent = (msg, type, data) => {
  if (type === 'timeline_step') {
    const normalizedStatus = data.status;
    const newTitle = data.title || '处理中';

    // 检查该 stepId 是否已经映射到某个步骤
    const mappedIndex = stepIdToIndex.value.get(data.id);
    let existing = mappedIndex !== undefined ? msg.steps[mappedIndex] : null;

    if (!existing) {
      // 检查最后一个步骤是否与新步骤同名
      const lastStep = msg.steps[msg.steps.length - 1];
      const shouldMerge = lastStep && lastStep.title === newTitle;

      if (shouldMerge) {
        // 合并到最后一个步骤：将新 stepId 映射到最后一个步骤
        const lastIndex = msg.steps.length - 1;
        stepIdToIndex.value.set(data.id, lastIndex);
        existing = lastStep;

        // 更新状态（如果新步骤的状态更"进步"，则更新）
        if (normalizedStatus && normalizedStatus !== 'in_progress') {
          existing.backendStatus = normalizedStatus;
          updateStepStatus(msg, existing);
        }
      } else {
        // 创建新步骤
        const newStep = {
          id: data.id,
          title: newTitle,
          status: normalizedStatus || 'in_progress',
          expanded: (normalizedStatus || 'in_progress') === 'in_progress',
          toolCallsExpanded: false, // 工具调用默认折叠
          thought: '',
          details: [],
          toolCalls: [],
          result: null,
          error: null,
          timestamp: data.timestamp || Date.now(),
          backendStatus: normalizedStatus || null,
          duration: data.duration || 0
        };
        msg.steps.push(newStep);
        stepIdToIndex.value.set(data.id, msg.steps.length - 1);
        return;
      }
    }

    // 更新现有步骤
    if (data.title) existing.title = data.title;
    if (normalizedStatus) {
      existing.backendStatus = normalizedStatus;
      updateStepStatus(msg, existing);
    }
    if (data.duration !== undefined) {
      existing.duration = data.duration;
      console.log('uuuuuuuuuuuu update duration:',existing, msg.steps);
    }

    // 提取用户友好的思考摘要
    if (typeof data.thought === 'string' && data.thought.trim()) {
      // 清洗 thought 内容
      const cleanedThought = cleanThought(data.thought);

      // 累加 thought 内容，而非替换
      // if (existing.thought && existing.thought.trim()) {
      //   // 如果已有 thought，追加新内容（避免重复）
      //   if (!existing.thought.includes(cleanedThought)) {
      //     existing.thought += '\n\n' + cleanedThought;
      //   }
      // } else {
      //   existing.thought = cleanedThought;
      // }
      existing.thought = cleanedThought;
      
      // 更新状态和展开逻辑（因为内容变化了）
      updateStepStatus(msg, existing);

      // 从清洗后的内容中提取摘要
      const summary = extractSummary(cleanedThought);
      if (summary.length > 0) {
        // 合并摘要，避免重复
        summary.forEach(item => {
          if (!existing.details.includes(item)) {
            existing.details.push(item);
          }
        });
        // 摘要变化也属于内容变化，再次更新状态
        updateStepStatus(msg, existing);
      }
    }

    // 处理错误信息
    if (data.error) {
      existing.error = typeof data.error === 'object'
        ? `${data.error.message}${data.error.suggestion ? '\n建议：' + data.error.suggestion : ''}`
        : data.error;
    }

    // 更新时间戳
    if (data.timestamp) {
      existing.timestamp = data.timestamp;
    }

  } else if (type === 'tool_call') {
    // 处理工具调用事件
    const stepId = data.step_id;
    const step = findOrCreateStep(msg, stepId, data);
    if (step) {
      handleToolCall(msg, step, data);
    }

  } else if (type === 'step_result') {
    // 处理步骤结果事件
    const stepId = data.step_id;
    const step = findOrCreateStep(msg, stepId, data);
    if (step) {
      handleStepResult(msg, step, data);
    }

  } else if (type === 'token') {
    // 流式内容输出 - 实时追加到消息内容中
    console.log('[Token Event] Received token:', data.content, 'Current content length:', msg.content.length);
    msg.content += data.content;
    console.log('[Token Event] Updated content length:', msg.content.length);

  } else if (type === 'error') {
    // 处理结构化错误消息
    const errorMessage = typeof data === 'object' && data.message
      ? `${data.message}${data.suggestion ? '\n建议：' + data.suggestion : ''}`
      : (data.error || '未知错误');

    msg.content += `\n\n**系统错误:** ${errorMessage}`;

    // 将所有进行中的步骤标记为失败
    msg.steps.forEach(s => {
      if (s.status === 'in_progress') {
        s.status = 'failed';
        s.error = errorMessage;
      }
    });

  } else if (type === 'session_start') {
    // 会话开始事件 - 可用于重置状态或记录
    console.log('Session started at:', data.timestamp);

  } else if (type === 'memory_recalled') {
    // 记忆召回事件 - 显示系统参考了哪些历史偏好
    const memories = data.memories || [];
    if (memories.length > 0) {
      const memoryStep = {
        id: `memory_recalled_${Date.now()}`,
        title: `已参考 ${memories.length} 条历史偏好`,
        status: 'completed',
        expanded: false,
        toolCallsExpanded: false,
        thought: '',
        details: memories.map(m => {
          const chapter = m.chapter_name ? `[${m.chapter_name}]` : '';
          return `${chapter} ${m.content}`;
        }),
        toolCalls: [],
        result: null,
        error: null,
        timestamp: Date.now(),
        backendStatus: 'completed',
        duration: 0,
        isMemoryStep: true
      };
      msg.steps.unshift(memoryStep);
      // 重建 stepIdToIndex 映射（因为 unshift 改变了索引）
      stepIdToIndex.value.clear();
      msg.steps.forEach((s, i) => stepIdToIndex.value.set(s.id, i));
    }

  } else if (type === 'done') {
    // 会话结束 - 确保所有步骤都已完成
    msg.steps.forEach(s => {
      if (s.status === 'in_progress') {
        s.status = 'completed';
      }
    });
  }
};

const toggleStep = (step) => {
  step.expanded = !step.expanded;
};

const toggleToolCalls = (step) => {
  step.toolCallsExpanded = !step.toolCallsExpanded;
};

const stepIconForStatus = (status) => {
  if (status === 'in_progress') return Loader2;
  if (status === 'completed') return CheckCircle2;
  if (status === 'needs_attention') return AlertCircle;
  return XCircle;
};

const stepColorClass = (status) => {
  if (status === 'in_progress') return 'step-progress';
  if (status === 'completed') return 'step-success';
  if (status === 'needs_attention') return 'step-warning';
  return 'step-error';
};

// 工具状态图标
const toolStatusIcon = (status) => {
  if (status === 'running') return Loader2;
  if (status === 'completed') return Check;
  if (status === 'failed') return XCircle;
  return Loader2;
};

// 结果类型图标
const resultIcon = (type) => {
  if (type === 'pass') return CheckCircle2;
  if (type === 'revise') return AlertTriangle;
  if (type === 'warning') return AlertCircle;
  return AlertCircle;
};

// 格式化时间戳
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// 格式化耗时
const formatDuration = (ms) => {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Number((ms / 1000).toFixed(1));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(0);
  return `${minutes}m ${remainingSeconds}s`;
};

// 清洗和格式化 thought 内容，提取用户友好的信息
const cleanThought = (rawThought) => {
  if (!rawThought || typeof rawThought !== 'string') return '';

  const lines = rawThought.split('\n');
  const cleaned = [];
  let listItemCount = 0;
  const maxListItems = 6;
  const maxTotalLines = 20;

  // 需要过滤的模式
  const filterPatterns = [
    /^(I think|I'm|I am|I will|I should|I need to|Let me)/i,
    /^(Thinking|Processing|Analyzing|Considering)/i,
    /tool_call|function_call|api_call/i,
    /^\s*```/,
  ];

  for (const line of lines) {
    if (cleaned.length >= maxTotalLines) break;

    const trimmed = line.trim();
    if (!trimmed) continue;

    // 检查是否应该过滤
    const shouldFilter = filterPatterns.some(pattern => pattern.test(trimmed));
    if (shouldFilter) continue;

    // 保留 Markdown 标题
    if (trimmed.startsWith('##')) {
      cleaned.push(line);
      continue;
    }

    // 保留列表项（限制数量）
    if (/^[-*•]\s/.test(trimmed)) {
      if (listItemCount < maxListItems) {
        cleaned.push(line);
        listItemCount++;
      }
      continue;
    }

    // 保留数字列表
    if (/^\d+\.\s/.test(trimmed)) {
      if (listItemCount < maxListItems) {
        cleaned.push(line);
        listItemCount++;
      }
      continue;
    }

    // 保留短段落（少于 100 字符），过滤过长的段落
    if (trimmed.length < 100 && !trimmed.includes(':')) {
      cleaned.push(line);
    }
  }

  // 如果清洗后为空，返回原始内容的前 200 字符
  if (cleaned.length === 0) {
    return rawThought.substring(0, 200) + (rawThought.length > 200 ? '...' : '');
  }

  return cleaned.join('\n').trim();
};

// 从 thought 中提取简要摘要（用于 details）
const extractSummary = (thought) => {
  if (!thought) return [];

  const lines = thought.split('\n');
  const summary = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 提取列表项
    const listMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (listMatch) {
      summary.push(listMatch[1]);
      if (summary.length >= 3) break;
      continue;
    }

    // 提取数字列表
    const numListMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numListMatch) {
      summary.push(numListMatch[1]);
      if (summary.length >= 3) break;
      continue;
    }
  }

  return summary;
};

// 关闭侧边栏
const closeSidebar = () => {
  emit('update:visible', false);
};

// 清理 AbortController
onBeforeUnmount(() => {
  if (abortController.value) {
    abortController.value.abort();
  }
});

</script>

<template>
  <div v-show="props.visible" class="chat-assistant">
    <div class="resize-handle" @mousedown="startResize"></div>
    <!-- Header - 重新设计 -->
    <div class="chat-header">
      <div class="header-left">
        <div class="header-icon-wrapper">
          <el-icon :size="20"><Sparkles /></el-icon>
        </div>
        <div class="header-text">
          <h2>AI 章节生成</h2>
          <span class="header-subtitle">智能生成建筑设计说明</span>
        </div>
      </div>
      <button @click="closeSidebar" class="close-btn" title="关闭">
        <el-icon :size="16"><Close /></el-icon>
      </button>
    </div>

    <!-- 上区：表单区域 -->
    <div class="form-panel">
      <!-- 顶部状态栏 (常驻) -->
      <div 
        class="chapter-status-bar" 
        @click="formPanelExpanded = !formPanelExpanded"
        role="button"
        tabindex="0"
        @keydown.enter.prevent="formPanelExpanded = !formPanelExpanded"
        @keydown.space.prevent="formPanelExpanded = !formPanelExpanded"
      >
        <div class="status-left">
          <el-icon class="status-icon"><Document /></el-icon>
          <span class="status-label">当前章节</span>
        </div>
        <div class="status-right">
          <span class="chapter-badge">{{ props.currentChapter?.id || '-' }}</span>
          <span class="chapter-name">{{ props.currentChapter?.title || '未选择章节' }}</span>
        </div>
        <el-button
          class="collapse-btn"
          size="small"
          text
          @click.stop="formPanelExpanded = !formPanelExpanded"
          :title="formPanelExpanded ? '折叠配置' : '展开配置'"
        >
          <el-icon :class="{ 'is-collapsed': !formPanelExpanded }"><ArrowUp /></el-icon>
        </el-button>
      </div>

      <!-- 可折叠内容区域 -->
      <el-collapse-transition>
        <div v-show="formPanelExpanded" class="form-body">
          <div class="form-content-scroll">
            <!-- 配置表单区域 -->
            <div class="form-cards">
              <!-- 项目概况卡片 -->
              <div class="form-card">
                <div class="card-header">
                  <el-icon class="card-icon"><Folder /></el-icon>
                  <span class="card-title">项目概况</span>
                  <el-tooltip content="从本地或后端获取项目信息，支持手动修改" placement="top">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
                <el-input
                  v-model="projectInfoText"
                  type="textarea"
                  :rows="12"
                  placeholder="项目名称: &#10;建设单位: &#10;项目地址: &#10;建筑面积: &#10;建筑高度: &#10;..."
                  resize="vertical"
                  :maxlength="2000"
                  show-word-limit
                  class="form-textarea"
                />
              </div>

              <!-- 章节模板卡片 -->
              <div class="form-card">
                <div class="card-header">
                  <el-icon class="card-icon"><Document /></el-icon>
                  <span class="card-title">章节模板</span>
                  <div style="flex: 1"></div>
                  <el-switch
                    v-model="isAutoMatchEnabled"
                    size="small"
                    active-text="自动匹配"
                  />
                </div>
                
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                  <!-- 模板选择器 -->
                  <el-select
                    v-model="selectedTemplateId"
                    :placeholder="isMatchingTemplate ? '模板匹配中...' : '未匹配到合适模板，请手动选择'"
                    clearable
                    filterable
                    class="template-select"
                    style="flex: 1; margin-bottom: 0"
                    @change="handleTemplateChange"
                  >
                    <el-option
                      v-for="item in documentTemplates"
                      :key="item.id"
                      :label="item.name"
                      :value="item.id"
                    />
                  </el-select>

                  <!-- 预览按钮 -->
                  <el-tooltip 
                    :content="selectedTemplateId ? '预览' : '请先选择模板'" 
                    placement="top"
                  >
                    <el-button 
                      :disabled="!selectedTemplateId"
                      type="primary" 
                      plain
                      class="preview-btn"
                      style="margin-left: 0; height: 32px; width: 32px; padding: 0; justify-content: center;"
                      @click="openTemplatePreview"
                    >
                      <el-icon><View /></el-icon>
                    </el-button>
                  </el-tooltip>
                </div>
              </div>

              <!-- 补充要求卡片 -->
              <div class="form-card">
                <div class="card-header">
                  <el-icon class="card-icon"><EditPen /></el-icon>
                  <span class="card-title">补充要求</span>
                  <!-- <span class="card-optional">可选</span> -->
                </div>
                <el-input
                  v-model="additionalRequirements"
                  type="textarea"
                  :rows="4"
                  placeholder="请输入额外的要求或特殊说明"
                  resize="vertical"
                  :maxlength="1000"
                  show-word-limit
                  class="form-textarea"
                />
              </div>

              <!-- 高级选项卡片 -->
              <div class="form-card">
                <div class="card-header">
                  <el-icon class="card-icon"><Setting /></el-icon>
                  <span class="card-title">高级选项</span>
                  <!-- <span class="card-optional">可选</span> -->
                </div>
                <div class="advanced-options">
                  <div class="option-item">
                    <div class="option-label">
                      <span>内容校验</span>
                      <el-tooltip
                        content="开启后，AI 将对生成的内容进行规范性校验，确保符合建筑规范要求。可能会增加生成时间。"
                        placement="top"
                      >
                        <el-icon class="help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </div>
                    <el-switch
                      v-model="enableAudit"
                      :disabled="isGenerating"
                      size="small"
                      active-text="开启"
                      inactive-text="关闭"
                    />
                  </div>
                </div>
                <div class="advanced-options">
                  <div class="option-item">
                    <div class="option-label">
                      <span>引用标记</span>
                      <el-tooltip
                        content="开启后， 将在生成内容的对应位置显示引用标记，供文档溯源。"
                        placement="top"
                      >
                        <el-icon class="help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </div>
                    <el-switch
                      v-model="enableCitation"
                      :disabled="isGenerating"
                      size="small"
                      active-text="开启"
                      inactive-text="关闭"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 生成按钮 (Moved to footer) -->
        </div>
      </el-collapse-transition>
    </div>

    <!-- 下区：Messages Area -->
    <div class="messages" ref="messagesContainer">
      <!-- Empty State -->
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-content">
          <el-icon class="empty-icon" :size="48"><Sparkles /></el-icon>
          <p class="empty-text">配置上方参数并点击“生成章节内容”开始</p>
        </div>
      </div>

      <!-- Messages -->
    <div v-for="msg in messages" :key="msg.id" class="message-wrapper">
      <!-- Message Timestamp -->
      <div v-if="msg.timestamp" class="message-timestamp-header">
        {{ formatTime(msg.timestamp) }}
      </div>

      <div :class="['message-group', msg.role]">
        <!-- Avatar -->
        <div class="message-avatar">
          <div :class="['avatar-icon', msg.role]">
            <el-icon v-if="msg.role === 'user'" :size="14"><User /></el-icon>
            <el-icon v-else :size="14"><Sparkles /></el-icon>
          </div>
        </div>

        <!-- Content -->
        <div class="message-content">
          <!-- User Message -->
          <div v-if="msg.role === 'user'" class="user-message">
            <div class="message-text">
              <MarkdownRenderer :content="msg.content" />
            </div>
          </div>

          <!-- Assistant Message -->
          <div v-else class="assistant-message">
            <!-- Timeline Steps -->
            <div v-if="msg.steps.length > 0" class="timeline-container">
              <div v-for="step in msg.steps" :key="step.id" class="timeline-step">
                <div :class="['step-main', step.isMemoryStep ? 'step-memory' : stepColorClass(step.status)]" @click="toggleStep(step)">
                  <div class="step-left">
                    <el-icon
                      :class="['step-status-icon', step.status]"
                      :size="14"
                    >
                      <component :is="step.isMemoryStep ? 'Coin' : stepIconForStatus(step.status)" />
                    </el-icon>
                    <span class="step-title">{{ step.title }}</span>
                  </div>
                  <div class="step-right">
                  <span v-if="step.duration" class="step-time">
                    {{ formatDuration(step.duration) }}
                  </span>
                  <el-icon
                      :class="['expand-icon', { expanded: step.expanded }]"
                      :size="14"
                    >
                      <ChevronRight />
                    </el-icon>
                  </div>
                </div>

                <!-- Expanded Details -->
                <transition name="expand">
                  <div v-if="step.expanded" class="step-details">
                    <!-- Memory Details (记忆召回详情) -->
                    <div v-if="step.isMemoryStep && step.details" class="memory-details">
                      <div v-for="(detail, idx) in step.details" :key="idx" class="memory-detail-item">
                        {{ detail }}
                      </div>
                    </div>

                    <!-- Tool Calls Section (工具调用) -->
                    <div v-if="step.toolCalls && step.toolCalls.length > 0" class="tool-calls-section">
                      <!-- 工具调用摘要（可点击展开） -->
                      <div class="tool-calls-summary" @click="toggleToolCalls(step)">
                        <el-icon class="summary-icon" :class="{ expanded: step.toolCallsExpanded }" :size="12">
                          <ChevronRight />
                        </el-icon>
                        <span class="summary-text">
                          工具调用 × {{ step.toolCalls.length }}
                          <span v-if="!step.toolCallsExpanded" class="tools-preview">
                            ({{ step.toolCalls.map(t => t.displayName || t.name).slice(0, 2).join(', ') }}{{ step.toolCalls.length > 2 ? '...' : '' }})
                          </span>
                        </span>
                      </div>

                      <!-- 工具调用详细列表（折叠） -->
                      <transition name="expand">
                        <div v-if="step.toolCallsExpanded" class="tool-calls-list">
                          <div v-for="tool in step.toolCalls" :key="tool.id" class="tool-call-item">
                            <div class="tool-header">
                              <el-icon
                                :class="['tool-icon', tool.status]"
                                :size="14"
                              >
                                <component :is="toolStatusIcon(tool.status)" />
                              </el-icon>
                              <span class="tool-name">{{ tool.displayName || tool.name }}</span>
                              <span :class="['tool-status-text', tool.status]">
                                {{ tool.status === 'running' ? '执行中...' : (tool.status === 'completed' ? '已完成' : (tool.status === 'failed' ? '失败' : tool.status)) }}
                              </span>
                              <span v-if="tool.duration" class="tool-duration">{{ tool.duration }}ms</span>
                            </div>
                            <div v-if="tool.result" class="tool-result">
                              {{ tool.result }}
                            </div>
                          </div>
                        </div>
                      </transition>
                    </div>

                    <!-- Details List -->
                    <div v-if="step.details && step.details.length > 0" class="details-section">
                      <div class="details-label">关键信息</div>
                      <ul class="details-list">
                        <li v-for="(detail, idx) in step.details" :key="idx">{{ detail }}</li>
                      </ul>
                    </div>

                    <!-- Step Result Section (步骤结果) -->
                    <div v-if="step.result" :class="['result-section', step.result.type]">
                      <div class="result-header">
                        <el-icon
                          :class="['result-icon', step.result.type]"
                          :size="14"
                        >
                          <component :is="resultIcon(step.result.type)" />
                        </el-icon>
                        <span class="result-message">{{ step.result.message }}</span>
                      </div>
                      <ul v-if="step.result.suggestions && step.result.suggestions.length > 0" class="result-suggestions">
                        <li v-for="(suggestion, idx) in step.result.suggestions" :key="idx">
                          {{ suggestion }}
                        </li>
                      </ul>
                    </div>

                    <!-- Thought Content -->
                    <div v-if="step.thought && step.thought.length > 0" class="thought-section">
                      <div class="thought-label">详细过程</div>
                      <div class="thought-content">
                        <MarkdownRenderer :content="step.thought" />
                      </div>
                    </div>

                    <!-- Empty State -->
                    <div v-if="(!step.details || step.details.length === 0) && (!step.thought || step.thought.length === 0) && !step.error && (!step.toolCalls || step.toolCalls.length === 0) && !step.result" class="empty-details">
                      暂无详细信息
                    </div>

                    <!-- Error -->
                    <div v-if="step.error" class="error-section">
                      <div class="error-label">错误信息</div>
                      <pre class="error-content">{{ step.error }}</pre>
                    </div>
                  </div>
                </transition>
              </div>
            </div>

            <!-- Loading Indicator -->
            <div v-if="isGenerating && msg === messages[messages.length - 1]" class="generation-status">
              <div class="typing-indicator">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- Footer Toolbar -->
    <div class="chat-footer">
      <el-button
        v-if="!isGenerating"
        type="primary"
        size="large"
        :disabled="!canGenerate"
        @click="handleGenerate"
        class="footer-btn generate-btn"
      >
        <el-icon class="btn-icon"><Sparkles /></el-icon>
        生成章节内容
      </el-button>

      <el-button
        v-else
        type="danger"
        size="large"
        @click="stopGeneration"
        class="footer-btn stop-btn"
      >
        <el-icon class="btn-icon"><Close /></el-icon>
        停止生成
      </el-button>
    </div>
    <!-- 模板预览弹窗 -->
    <el-dialog
      v-model="templatePreviewVisible"
      :title="templatePreviewTitle"
      width="600px"
      append-to-body
      class="template-preview-dialog"
    >
      <div style="display: flex; flex-direction: column; overflow: hidden;">
        <div style="margin-bottom: 12px; flex-shrink: 0;">
          <div style="font-weight: 600; margin-bottom: 4px; color: #1e3a5f;">模板描述</div>
          <div style="font-size: 14px; color: #475569; line-height: 1.5;">{{ templatePreviewDescription }}</div>
        </div>
        
        <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
          <div style="font-weight: 600; margin-bottom: 4px; color: #1e3a5f;">模板章节</div>
          <div class="template-preview-content" style="flex: 1; overflow-y: auto;">
            <MarkdownRenderer :content="templatePreviewContent" />
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
/* ============================================
   AI 章节生成助手 - 统一蓝色主题设计
   ============================================ */

/* 基础布局 */
.chat-assistant {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
  color: var(--gray-900);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  font-size: 13px;
  overflow: hidden;
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.06);
  border-left: 1px solid #e2e8f0;
}

/* ============================================
   Header - 简洁现代风格
   ============================================ */
.chat-header {
  padding: 12px 16px;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.2);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-wrapper {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.message-timestamp-header {
  width: 100%;
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
  margin-bottom: 8px;
  user-select: none;
}

.chat-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.3px;
  line-height: 1.2;
}

.header-subtitle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 400;
}

.close-btn {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

/* ============================================
   表单面板样式
   ============================================ */
.form-panel {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.form-body {
  /* 移除 flex，避免动画计算抖动 */
  overflow: hidden; /* 确保动画期间内容不溢出 */
  will-change: height; /* 提示浏览器优化高度变化 */
}

.form-content-scroll {
  /* flex: 1; 不需要，父级不再是 flex */
  padding: 0 0 30px 0;
  overflow-y: auto;
  max-height: 75vh;
  /* 优化滚动条防止抖动 */
  scrollbar-gutter: stable; 
}

.form-content-scroll::-webkit-scrollbar {
  width: 6px;
}

.form-content-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.form-content-scroll::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 章节状态栏 */
.chapter-status-bar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-bottom: 1px solid #bfdbfe;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #1e40af;
}

.status-icon {
  font-size: 14px;
}

.status-label {
  font-size: 12px;
  font-weight: 500;
}

.status-right {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chapter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 22px;
  padding: 0 8px;
  background: #1976d2;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
}

.chapter-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e3a5f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collapse-btn {
  margin-left: auto;
  color: #1976d2 !important;
  padding: 4px 8px !important;
}

.collapse-btn:hover {
  background: rgba(25, 118, 210, 0.1) !important;
}

.collapse-btn .el-icon {
  transition: transform 0.3s ease;
}

.collapse-btn .el-icon.is-collapsed {
  transform: rotate(180deg);
}

/* 表单卡片容器 */
.form-cards {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 表单卡片 */
.form-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  transition: all 0.2s ease;
}

.form-card:hover {
  border-color: #94a3b8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.form-card:focus-within {
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.preview-btn {
  margin-left: auto;
  font-size: 12px;
}

.template-select {
  width: 100%;
  margin-bottom: 8px;
}

.template-preview-content {
  max-height: 500px;
  overflow-y: auto;
  padding: 10px;
  background: #f8fafc;
  border-radius: 4px;
}

.template-preview-content :deep(pre) {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: hidden;
}

.card-icon {
  font-size: 16px;
  color: #1976d2;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e3a5f;
}

.card-optional {
  font-size: 11px;
  color: #94a3b8;
  margin-left: auto;
  padding: 2px 6px;
  background: #f1f5f9;
  border-radius: 4px;
}

.help-icon {
  cursor: help;
  color: #94a3b8;
  font-size: 14px;
  margin-left: 4px;
  transition: color 0.15s ease;
}

.help-icon:hover {
  color: #1976d2;
}

/* 高级选项样式 */
.advanced-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #334155;
  font-weight: 500;
}

/* Textarea 样式 */
.form-textarea :deep(.el-textarea__inner) {
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.2s ease;
  padding: 10px 12px;
}

.form-textarea :deep(.el-textarea__inner):hover {
  border-color: #cbd5e1;
}

.form-textarea :deep(.el-textarea__inner):focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
  background: #ffffff;
}

.form-textarea :deep(.el-input__count) {
  background: transparent;
  font-size: 10px;
  color: #94a3b8;
}

/* Footer Toolbar */
.chat-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 16px;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.03);
  z-index: 10;
}

.footer-btn {
  width: 100%;
  max-width: 280px;
  height: 44px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.25s ease;
}

.stop-btn.footer-btn {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.stop-btn.footer-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
}

.stop-btn.footer-btn:active {
  transform: translateY(0);
}

.generate-btn {
  width: 100%;
  max-width: 280px;
  height: 44px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border: none;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
  transition: all 0.25s ease;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(25, 118, 210, 0.4);
}

.generate-btn:active:not(:disabled) {
  transform: translateY(0);
}

.generate-btn:disabled {
  background: #cbd5e1;
  color: #94a3b8;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-icon {
  margin-right: 6px;
  font-size: 16px;
}

/* 折叠状态按钮 - 已废弃，合并入 status-bar */

/* ============================================
   Messages Area - 优化消息区域
   ============================================ */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 90px 16px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative; /* For empty state positioning */
}

.empty-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  pointer-events: none; /* Allow clicking through if needed, though mostly empty */
}

.empty-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-icon {
  color: #cbd5e1;
}

.empty-text {
  font-size: 14px;
  color: #64748b;
}

.messages::-webkit-scrollbar {
  width: 6px;
}

.messages::-webkit-scrollbar-track {
  background: transparent;
}

.messages::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.messages::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* ============================================
   Message Group
   ============================================ */
.message-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.message-group {
  display: flex;
  gap: 12px;
  width: 100%;
  animation: fadeIn 0.3s ease-out;
}

.generation-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding-left: 4px;
}

/* ============================================
   Avatar
   ============================================ */
.message-avatar {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
}

.avatar-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.avatar-icon.user {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: #ffffff;
}

.avatar-icon.assistant {
  background: linear-gradient(135deg, #1976d2 0%, #0d9488 100%);
  color: #ffffff;
}

/* ============================================
   Message Content
   ============================================ */
.message-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* User Message */
.user-message {
  max-width: 85%;
}

.message-text {
  padding: 8px 12px;
  background: var(--gray-100);
  border-radius: 8px;
  border: 1px solid var(--gray-200);
  font-size: 13px;
  line-height: 1.5;
  color: var(--gray-900);
}

.message-text :deep(p) {
  margin: 0;
}

/* Assistant Message */
.assistant-message {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

/* ============================================
   Timeline Container - 优化时间线
   ============================================ */
.timeline-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.timeline-step {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.timeline-step:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Step Main Header */
.step-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.step-main:hover {
  background: var(--gray-100);
}

.step-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.step-status-icon {
  flex-shrink: 0;
}

.step-status-icon.in_progress {
  color: #1976d2;
  animation: spin 1.5s linear infinite;
}

.step-status-icon.completed {
  color: #0d9488;
}

.step-status-icon.needs_attention {
  color: #d97706;
}

.step-status-icon.failed {
  color: #dc2626;
}

.step-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-time {
  font-size: 10px;
  color: var(--gray-600);
  font-variant-numeric: tabular-nums;
}

.expand-icon {
  color: var(--gray-600);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

/* Step Color Classes - 统一蓝色主题 */
.step-progress {
  border-left: 3px solid #1976d2;
  background: linear-gradient(90deg, rgba(25, 118, 210, 0.04) 0%, transparent 100%);
}

.step-success {
  border-left: 3px solid #0d9488;
  background: linear-gradient(90deg, rgba(13, 148, 136, 0.04) 0%, transparent 100%);
}

.step-warning {
  border-left: 3px solid #d97706;
  background: linear-gradient(90deg, rgba(217, 119, 6, 0.04) 0%, transparent 100%);
}

.step-error {
  border-left: 3px solid #dc2626;
  background: linear-gradient(90deg, rgba(220, 38, 38, 0.04) 0%, transparent 100%);
}

/* Memory recall step - 紫色主题区分 */
.timeline-step:has(.step-main[data-memory]) {
  border-color: #7c3aed;
}

.timeline-step .step-main.step-memory {
  border-left: 3px solid #7c3aed;
  background: linear-gradient(90deg, rgba(124, 58, 237, 0.06) 0%, transparent 100%);
}

/* Memory details */
.memory-details {
  padding: 8px 0;
}

.memory-detail-item {
  padding: 6px 12px;
  margin: 4px 0;
  font-size: 12px;
  color: #4b5563;
  line-height: 1.5;
  border-left: 2px solid #c4b5fd;
  background: rgba(124, 58, 237, 0.03);
  border-radius: 0 4px 4px 0;
}

/* ============================================
   Step Details (Expanded)
   ============================================ */
.step-details {
  padding: 0 12px 12px 12px;
  background: white;
  border-top: 1px solid var(--gray-200);
}

.details-section,
.thought-section,
.error-section {
  margin-top: 8px;
}

.details-label,
.thought-label,
.error-label,
.section-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.details-list {
  margin: 0;
  padding-left: 20px;
  color: var(--gray-700);
  font-size: 12px;
  line-height: 1.6;
}

.details-list li {
  margin-bottom: 4px;
}

.thought-content {
  font-size: 12px;
  color: var(--gray-700);
  line-height: 1.6;
}

.empty-details {
  margin-top: 8px;
  padding: 12px;
  text-align: center;
  font-size: 11px;
  color: var(--gray-500);
  font-style: italic;
  background: var(--gray-50);
  border-radius: 4px;
  border: 1px dashed var(--gray-300);
}

.thought-content :deep(.markdown-body) {
  background: transparent !important;
  color: inherit;
  font-size: 12px;
}

.thought-content :deep(h1),
.thought-content :deep(h2),
.thought-content :deep(h3),
.thought-content :deep(h4) {
  font-size: 12px;
  font-weight: 600;
  margin: 8px 0 4px 0;
  color: var(--gray-900);
  border-bottom: none;
}

.thought-content :deep(p) {
  margin: 4px 0;
}

.thought-content :deep(ul),
.thought-content :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}

.error-content {
  margin: 0;
  padding: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  color: var(--error-color);
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ============================================
   Tool Calls Section (工具调用)
   ============================================ */
.tool-calls-section {
  margin-top: 8px;
}

/* 工具调用摘要（折叠触发器） */
.tool-calls-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #f0f9ff;
  border-radius: 4px;
  border-left: 2px solid #1976d2;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  color: #1e40af;
  font-weight: 500;
}

.tool-calls-summary:hover {
  background: #dbeafe;
}

.summary-icon {
  flex-shrink: 0;
  transition: transform 0.2s;
}

.summary-icon.expanded {
  transform: rotate(90deg);
}

.summary-text {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tools-preview {
  font-size: 11px;
  color: #64748b;
  font-weight: 400;
  margin-left: 4px;
}

/* 工具调用详细列表 */
.tool-calls-list {
  margin-top: 6px;
  padding-left: 8px;
}

/* 工具调用项 */
.tool-call-item {
  padding: 6px 8px;
  margin-bottom: 4px;
  background: #f8fafc;
  border-radius: 4px;
  border-left: 2px solid #94a3b8;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--gray-900);
}

.tool-icon {
  flex-shrink: 0;
}

.tool-icon.running {
  color: #1976d2;
  animation: spin 1.5s linear infinite;
}

.tool-icon.completed {
  color: #0d9488;
}

.tool-icon.failed {
  color: #dc2626;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.tool-name {
  flex: 1;
  font-weight: 500;
}

.tool-status-text {
  font-size: 10px;
  margin-left: 8px;
  padding: 1px 4px;
  border-radius: 3px;
  background: #f1f5f9;
  color: #64748b;
}

.tool-status-text.running {
  color: #1976d2;
  background: rgba(25, 118, 210, 0.1);
}

.tool-status-text.completed {
  color: #0d9488;
  background: rgba(13, 148, 136, 0.1);
}

.tool-status-text.failed {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

.tool-duration {
  margin-left: auto;
  font-size: 10px;
  color: var(--gray-600);
  font-family: 'Consolas', 'Monaco', monospace;
}

.tool-result {
  margin-top: 4px;
  padding-left: 18px;
  font-size: 10px;
  color: var(--gray-700);
  line-height: 1.4;
}

/* ============================================
   Step Result Section (步骤结果)
   ============================================ */
.result-section {
  margin-top: 12px;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid;
}

.result-section.pass {
  background: #f0fdfa;
  border-color: #0d9488;
}

.result-section.revise {
  background: #fffbeb;
  border-color: #d97706;
}

.result-section.warning {
  background: #fffbeb;
  border-color: #d97706;
}

.result-section.info {
  background: #eff6ff;
  border-color: #1976d2;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}

.result-icon {
  flex-shrink: 0;
}

.result-section.pass .result-icon,
.result-section.pass .result-message {
  color: #0d9488;
}

.result-section.revise .result-icon,
.result-section.revise .result-message {
  color: #d97706;
}

.result-section.warning .result-icon,
.result-section.warning .result-message {
  color: #d97706;
}

.result-section.info .result-icon,
.result-section.info .result-message {
  color: #1976d2;
}

.result-message {
  flex: 1;
}

.result-suggestions {
  margin: 8px 0 0 0;
  padding-left: 20px;
  font-size: 11px;
  color: var(--gray-700);
  list-style: disc;
}

.result-suggestions li {
  margin-bottom: 4px;
  line-height: 1.4;
}

/* ============================================
   Expand Transition
   ============================================ */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
  opacity: 1;
}

/* ============================================
   Typing Indicator - 优化加载指示器
   ============================================ */
.typing-indicator {
  display: flex;
  gap: 5px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  width: fit-content;
  box-shadow: 0 2px 6px rgba(25, 118, 210, 0.1);
}

.dot {
  width: 8px;
  height: 8px;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* ============================================
   Responsive & Accessibility
   ============================================ */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: col-resize;
  z-index: 100;
  transition: background-color 0.2s;
  background-color: transparent;
}

.resize-handle:hover,
.resize-handle:active {
    background-color: #3b82f6;
  }

  @media (max-width: 768px) {
    .resize-handle {
      display: none;
    }
  }
</style>
