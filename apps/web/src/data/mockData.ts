// Mock数据文件
export interface ProjectInfo {
  projectName: string
  constructionUnit: string
  designUnit: string
  projectAddress: string
  buildingArea: string
  buildingHeight: string
  buildingType: string
  structureType: string
  floors: string
  undergroundFloors: string
  projectDescription?: string // 项目概况描述
  // 新增字段
  landUseType?: string // 土地使用性质
  seismicIntensity?: string // 抗震设防烈度
  climateZone?: string // 建筑气候分区
  indoorOutdoorHeight?: string // 室内外高差
  absoluteElevation?: string // 绝对标高
  buildingName?: string // 建筑名称
  buildingFunction?: string // 使用功能
  plotRatioArea?: string // 计容面积
  structureDesignLife?: string // 结构设计使用年限
  fireResistanceGrade?: string // 耐火等级
  fireCategory?: string // 防火类别
  waterproofCategory?: string // 防水类别
  waterproofGrade?: string // 防水等级
  roofWaterproofLife?: string // 屋面防水合理使用年限
  energyEfficiencyRequirement?: string // 节能要求
  barrierFreeRequirement?: string // 无障碍要求
  professionTagId?: number    // 专业标签 ID（单选）
  businessTypeTagId?: number  // 业态标签 ID（单选）
}

export interface DocumentItem {
  id: string
  name: string
  lastModified: string
  status: 'draft' | 'reviewing' | 'finalized'
  isActive: boolean
  projectInfo?: ProjectInfo
  outline?: Array<{id: number, title: string, order: number}> // 添加大纲字段
}

export interface ProjectItem {
  id: string
  name: string
  code?: string
  stage?: string
  lastUpdated: string
  unreadCount?: number
  pinned?: boolean
  isActive?: boolean
  sessionList?: Array<{id?: string, name: string}>
}

export interface Chapter {
  id: string,
  chapterId: string,
  type: string,
  title: string,
  hasContent: Boolean,
  loading: Boolean,
  actions: Array<string>,
  children: Array<Chapter>,
  paragraphs: Array<{type: string, content: any}>,
}

export interface OutlineItem {
  id: number,
  title: string,
  order: number,
  children: Array<OutlineItem>,
  expanded: boolean,
}

// 导出格式
// export const exportFormats = [
//   { label: 'PDF', value: 'pdf' },
//   { label: 'Markdown', value: 'md' },
//   { label: 'AutoCAD', value: 'cad' }
// ]

// 文档元数据
export const docMetaData = [
  {name:'高层建筑',type:'primary'},
  {name:'地上30层',type:'success'},
  {name:'框架-剪力墙结构',type:'warning'},
]

export const outlineTemplate: OutlineItem[] = [
  {
    id: 1,
    title: '设计依据',
    order: 1,
    children: [
      { id: 11, title: '工程设计有关批文', order: 1, children: [], expanded: false },
      { id: 12, title: '现行国家和地方规范、标准和规定', order: 2, children: [], expanded: false },
      { id: 13, title: '设计任务书与往来函', order: 3, children: [], expanded: false },
      { id: 14, title: '方案设计文件及施工图设计要求', order: 4, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 2,
    title: '工程概况',
    order: 2,
    children: [
      { id: 21, title: '工程名称', order: 1, children: [], expanded: false },
      { id: 22, title: '工程地点', order: 2, children: [], expanded: false },
      { id: 23, title: '工程规模', order: 3, children: [], expanded: false },
      { id: 24, title: '建筑类别', order: 4, children: [], expanded: false },
      { id: 25, title: '功能布局', order: 5, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 3,
    title: '建筑定位、设计标高及尺寸标注',
    order: 3,
    children: [
      { id: 31, title: '建筑定位', order: 1, children: [], expanded: false },
      { id: 32, title: '设计标高', order: 2, children: [], expanded: false },
      { id: 33, title: '标注单位', order: 3, children: [], expanded: false },
      { id: 34, title: '标高标注说明', order: 4, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 4,
    title: '墙体工程',
    order: 4,
    children: [
      { id: 41, title: '材料及选型', order: 1, children: [], expanded: false },
      { id: 42, title: '构造要求', order: 2, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 5,
    title: '屋面工程',
    order: 5,
    children: [],
    expanded: true,
  },
  {
    id: 6,
    title: '楼地面工程',
    order: 6,
    children: [],
    expanded: true,
  },
  {
    id: 7,
    title: '门窗、隔断工程',
    order: 7,
    children: [
      { id: 71, title: '门窗与隔断总体要求', order: 1, children: [], expanded: false },
      { id: 72, title: '立面与深化设计要求', order: 2, children: [], expanded: false },
      { id: 73, title: '加工尺寸与现场复核', order: 3, children: [], expanded: false },
      { id: 74, title: '木门材料与油漆', order: 4, children: [], expanded: false },
      { id: 75, title: '玻璃选型与安全要求', order: 5, children: [], expanded: false },
      { id: 76, title: '玻璃防撞提示', order: 6, children: [], expanded: false },
      { id: 77, title: '门窗性能指标', order: 7, children: [], expanded: false },
      { id: 78, title: '外窗开启与排烟窗', order: 8, children: [], expanded: false },
      { id: 79, title: '内窗台板设置', order: 9, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 8,
    title: '幕墙、天窗、玻璃雨棚工程',
    order: 8,
    children: [
      { id: 81, title: '幕墙类型与材料', order: 1, children: [], expanded: false },
      { id: 82, title: '玻璃幕墙技术要求', order: 2, children: [], expanded: false },
      { id: 83, title: '玻璃选型规范', order: 3, children: [], expanded: false },
      { id: 84, title: '性能与深化设计', order: 4, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 9,
    title: '装修工程',
    order: 9,
    children: [
      { id: 91, title: '室内装修', order: 1, children: [], expanded: false },
      { id: 92, title: '室外装修', order: 2, children: [], expanded: false },
      { id: 93, title: '材料封样与验收', order: 3, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 10,
    title: '电梯工程',
    order: 10,
    children: [
      { id: 101, title: '电梯数量与类型', order: 1, children: [], expanded: false },
      { id: 102, title: '电梯参数', order: 2, children: [], expanded: false },
      { id: 103, title: '预埋件与井道要求', order: 3, children: [], expanded: false },
      { id: 104, title: '节能措施', order: 4, children: [], expanded: false },
      { id: 105, title: '消防电梯要求', order: 5, children: [], expanded: false },
      { id: 106, title: '无障碍电梯要求', order: 6, children: [], expanded: false },
      { id: 107, title: '电梯装修与耐火', order: 7, children: [], expanded: false },
      { id: 108, title: '电梯选型表', order: 8, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 11,
    title: '消防设计',
    order: 11,
    children: [],
    expanded: true,
  },
  {
    id: 12,
    title: '无障碍设计',
    order: 12,
    children: [
      { id: 124, title: '无障碍通道', order: 1, children: [], expanded: false },
      { id: 125, title: '无障碍出入口', order: 2, children: [], expanded: false },
      { id: 126, title: '无障碍电梯', order: 3, children: [], expanded: false },
      { id: 127, title: '无障碍卫生间', order: 4, children: [], expanded: false },
      { id: 128, title: '无障碍使用的门', order: 5, children: [], expanded: false },
      { id: 129, title: '无障碍标识', order: 6, children: [], expanded: false },
      { id: 1210, title: '其他', order: 7, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 13,
    title: '防水设计',
    order: 13,
    children: [
      { id: 131, title: '设计依据', order: 1, children: [], expanded: false },
      { id: 132, title: '工程与使用环境概况', order: 2, children: [], expanded: false },
      { id: 133, title: '分部位防水设计', order: 3, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 14,
    title: '安全防护设计',
    order: 14,
    children: [
      { id: 141, title: '设计依据', order: 1, children: [], expanded: false },
      { id: 142, title: '防坠落', order: 2, children: [], expanded: false },
      { id: 143, title: '防坠物', order: 3, children: [], expanded: false },
      { id: 144, title: '防冲撞', order: 4, children: [], expanded: false },
      { id: 145, title: '防滑', order: 5, children: [], expanded: false },
      { id: 146, title: '室内环境污染控制', order: 6, children: [], expanded: false },
      { id: 147, title: '其他', order: 7, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 15,
    title: '隔声、降噪、减震设计',
    order: 15,
    children: [
      { id: 151, title: '设计依据', order: 1, children: [], expanded: false },
      { id: 152, title: '隔声', order: 2, children: [], expanded: false },
      { id: 153, title: '降噪', order: 3, children: [], expanded: false },
      { id: 154, title: '减震', order: 4, children: [], expanded: false },
    ],
    expanded: true,
  },
  {
    id: 16,
    title: '标识设计',
    order: 16,
    children: [
      { id: 161, title: '设计依据', order: 1, children: [], expanded: false },
      { id: 162, title: '安全防护警示和引导标识系统', order: 2, children: [], expanded: false },
      { id: 163, title: '消防救援与安全疏散标识系统', order: 3, children: [], expanded: false },
      { id: 164, title: '无障碍标识', order: 4, children: [], expanded: false },
      { id: 165, title: '室内停车场车行导向标识系统', order: 5, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 17,
    title: '构件防腐及油漆粉刷工程',
    order: 17,
    children: [
      { id: 171, title: '木构件防腐与涂饰', order: 1, children: [], expanded: false },
      { id: 172, title: '金属构件防腐与涂饰', order: 2, children: [], expanded: false },
      { id: 173, title: '室外金属制品涂饰', order: 3, children: [], expanded: false },
      { id: 174, title: '样板与封样验收', order: 4, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 18,
    title: '安全管理',
    order: 18,
    children: [
      { id: 181, title: '危险性较大工程安全管理规定', order: 1, children: [], expanded: false },
      { id: 182, title: '危大工程专项施工方案', order: 2, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 19,
    title: '工种配合和施工要点',
    order: 19,
    children: [
      { id: 191, title: '预留预埋与专业配合', order: 1, children: [], expanded: false },
      { id: 192, title: '管线综合施工方案', order: 2, children: [], expanded: false },
      { id: 193, title: '材料要求与耐久性', order: 3, children: [], expanded: false },
      { id: 194, title: '设备资料与安装配合', order: 4, children: [], expanded: false },
      { id: 195, title: '厨房深化设计', order: 5, children: [], expanded: false },
      { id: 196, title: '幕墙深化设计', order: 6, children: [], expanded: false },
      { id: 197, title: '精装修深化设计', order: 7, children: [], expanded: false },
      { id: 198, title: '规范遵循与审查', order: 8, children: [], expanded: false },
      { id: 199, title: '图纸尺寸与审查合格', order: 9, children: [], expanded: false },
      { id: 1910, title: '专项设计与配套计算书', order: 10, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 20,
    title: '人防设计',
    order: 20,
    children: [],
    expanded: false,
  },
  {
    id: 21,
    title: '节能设计',
    order: 21,
    children: [
      { id: 211, title: '设计依据', order: 1, children: [], expanded: false },
      { id: 212, title: '工程概况', order: 2, children: [], expanded: false },
      { id: 213, title: '窗墙面积比、体形系数与限值的对比', order: 3, children: [], expanded: false },
      { id: 214, title: '围护结构传热系数（w/（m2.k））与限值的对比', order: 4, children: [], expanded: false },
      { id: 215, title: '节能措施及保温材料', order: 5, children: [], expanded: false },
      { id: 216, title: '保温材料物理性能', order: 6, children: [], expanded: false },
      { id: 217, title: '外门窗性能', order: 7, children: [], expanded: false },
      { id: 218, title: '保温构造', order: 8, children: [], expanded: false },
    ],
    expanded: true,
  },
  {
    id: 22,
    title: '碳排放计算和可再生能源利用',
    order: 22,
    children: [
      { id: 221, title: '设计依据', order: 1, children: [], expanded: false },
      { id: 222, title: '维护结构做法', order: 2, children: [], expanded: false },
      { id: 223, title: '设计建筑碳排放情况', order: 3, children: [], expanded: false },
      { id: 224, title: '可再生能源系统', order: 4, children: [], expanded: false },
      { id: 225, title: '建筑运行碳排放', order: 5, children: [], expanded: false },
    ],
    expanded: true,
  },
  {
    id: 23,
    title: '绿色建筑设计',
    order: 23,
    children: [
      { id: 232, title: '设计依据', order: 1, children: [], expanded: false },
      { id: 233, title: '评定表格', order: 2, children: [], expanded: false },
      { id: 234, title: '绿色建筑设计规范', order: 3, children: [], expanded: false },
      { id: 235, title: '绿色建筑设计规范', order: 4, children: [], expanded: false },
      { id: 236, title: '绿色建筑设计规范', order: 5, children: [], expanded: false },
    ],
    expanded: true,
  },
  {
    id: 24,
    title: '装配式设计',
    order: 24,
    children: [
      { id: 241, title: '项目概况', order: 1, children: [], expanded: false },
      { id: 242, title: '设计依据', order: 2, children: [], expanded: false },
      { id: 243, title: '设计内容', order: 3, children: [], expanded: false },
      { id: 244, title: '装配率计算表', order: 4, children: [], expanded: false }
    ],
    expanded: true,
  },
  {
    id: 25,
    title: '海绵城市设计',
    order: 25,
    children: [],
    expanded: true,
  },
  {
    id: 26,
    title: '附表',
    order: 26,
    children: [
      { id: 261, title: '技术经济指标', order: 1, children: [], expanded: false },
      { id: 262, title: '装修构造做法表', order: 2, children: [], expanded: false },
      { id: 263, title: '装修材料选用表', order: 3, children: [], expanded: false }
    ],
    expanded: true,
  },
]

// 章节数据
export const mockChapters = [
  { id: '1', title: '设计依据', active: true, children: [
    { id: '1.1', title: '国家及地方规范' },
    { id: '1.2', title: '项目文件' }
  ]},
  { id: '2', title: '工程概况', active: false },
  { id: '3', title: '建筑设计', active: false, children: [
    { id: '3.1', title: '总平面设计' },
    { id: '3.2', title: '平面设计' },
    { id: '3.3', title: '立面设计' },
    { id: '3.4', title: '防火设计' }
  ]},
  { id: '4', title: '结构设计', active: false, children: [
    { id: '4.1', title: '结构体系' },
    { id: '4.2', title: '基础设计' },
    { id: '4.3', title: '主体结构' }
  ]},
  { id: '5', title: '给排水设计', active: false },
  { id: '6', title: '电气设计', active: false },
  { id: '7', title: '暖通设计', active: false },
  { id: '8', title: '节能设计', active: false }
]

// 表格数据
export const tableTest = [
  {
    item1: '总用地面积',
    value1: '15,000 ㎡',
    item2: '总建筑面积',
    value2: '80,000 ㎡'
  },
  {
    item1: '地上建筑面积',
    value1: '65,000 ㎡',
    item2: '地下建筑面积',
    value2: '15,000 ㎡'
  },
  {
    item1: '建筑层数',
    value1: '地上30层，地下2层',
    item2: '建筑高度',
    value2: '99.5 m'
  },
  {
    item1: '结构形式',
    value1: '框架-剪力墙结构',
    item2: '抗震设防烈度',
    value2: '7度'
  }
]

// 知识库数据
export const knowledgeItems = [
  {
    id: 1,
    category: 'fire',
    title: '消防设计 - 疏散宽度',
    snippet: '疏散楼梯的净宽度不应小于1.10m，疏散走道和疏散门的净宽度不应小于1.40m...',
    tag: 'GB 50016-2014',
    usage: 256
  },
  {
    id: 2,
    category: 'fire', 
    title: '消防设计 - 消火栓系统',
    snippet: '室内消火栓系统应保证同时使用水枪数量，每支水枪流量不小于5L/s，高层建筑不小于10支...',
    tag: 'GB 50974-2014',
    usage: 134
  },
  {
    id: 3,
    category: 'structure',
    title: '混凝土结构 - 耐久性',
    snippet: '一类环境，设计使用年限50年的钢筋混凝土结构，最小混凝土保护层厚度：板15mm，梁柱25mm...',
    tag: 'GB 50010-2010',
    usage: 98
  }
]

// 知识库分类
export const knowledgeCategories = [
  {key:0,name:'全部',label:'all'},
  {key:1,name:'防火',label:'fire'},
  {key:2,name:'结构',label:'structure'},
  {key:3,name:'机电',label:'electrical'}
]

// 知识库权重
export const knowledgeWeights = [
  {name:'国家标准规范',weight:75},
  {name:'公司设计标准',weight:60},
  {name:'类似项目经验',weight:45},
]

// 知识库列表
export const knowledgeBaseList = [
  {
    id: 1,
    name: '东北院大厦-设计...',
    type: 'project',
    icon: '📁',
    description: '类似项目设计经验'
  },
  {
    id: 2,
    name: '建筑设计防火规范',
    type: 'standard',
    icon: '📋',
    description: 'GB 50016-2014'
  },
  {
    id: 3,
    name: '民用建筑设计统一标准',
    type: 'standard',
    icon: '📋',
    description: 'GB 50352-2019'
  },
  {
    id: 4,
    name: '建筑结构荷载规范',
    type: 'standard',
    icon: '📋',
    description: 'GB 50009-2012'
  },
  {
    id: 5,
    name: '公司设计标准手册',
    type: 'company',
    icon: '🏢',
    description: '内部设计规范'
  },
  {
    id: 6,
    name: '绿色建筑评价标准',
    type: 'standard',
    icon: '📋',
    description: 'GB/T 50378-2019'
  }
]

export const mockProjects: ProjectItem[] = [
  {
    id: 'p-001',
    name: '上海中心大厦电气设计',
    code: 'SH-CENTER',
    stage: '施工图',
    lastUpdated: new Date().toLocaleString('zh-CN'),
    unreadCount: 3,
    pinned: true,
    isActive: true,
    sessionList:[
    {
      name:'负荷计算与变压器选型'
    },
    {
      name:'消防应急照明系统设计'
    },{
      name:'IT隔离电源系统配置'
    }]
  },
  {
    id: 'p-002',
    name: '205密闭空间样例项目',
    code: 'EX-205',
    stage: '方案阶段',
    lastUpdated: new Date().toLocaleString('zh-CN'),
    unreadCount: 1,
    pinned: false,
    isActive: false
  },
  {
    id: 'p-003',
    name: '上工程实践经验汇编',
    code: 'PRAC-COLLECT',
    stage: '归档',
    lastUpdated: new Date().toLocaleString('zh-CN'),
    unreadCount: 0,
    pinned: false,
    isActive: false
  }
]

// 文档mock数据
export const mockDocumentsData: Chapter[] = [
    {
        id: '1',
        chapterId: 'chapter-1',
        type: 'chapter',
        title: '设计依据',
        hasContent: true,
        loading:false,
        actions: ['continue', 'rewrite'],
        children: [
          {
            id: '1.1',
            chapterId: 'chapter-1-1',
            type: 'subchapter',
            title: '国家及地方规范',
            hasContent: true,
            loading: false,
            actions: ['continue', 'rewrite'],
            children: [],
            paragraphs: [
              {
                type: 'text',
                content: `<ul>
                <li>《建筑设计防火规范》GB 50016-2014（2018年版）</li>
                <li>《民用建筑设计统一标准》GB 50352-2019</li>
                <li>《混凝土结构设计规范》GB 50010-2010（2015年版）</li>
                <li>《建筑抗震设计规范》GB 50011-2010（2016年版）</li>
                <li>《高层民用建筑设计防火规范》GB 50045-95（2005年版）</li>
              </ul>`
              },
              {
                type:'table',
                content: [...tableTest]
              }
            ]
          },
          {
            id: '1.2',
            chapterId: 'chapter-1-2',
            type: 'subchapter',
            title: '项目文件',
            hasContent: true,
            loading: false,
            actions: ['continue', 'rewrite'],
            children: [],
            paragraphs: [
              {
                type: 'text',
                content: `
                   <ul>
                    <li>建设单位提供的设计任务书</li>
                    <li>规划部门批准的规划设计条件</li>
                    <li>地质勘察报告</li>
                </ul>
                `
              }
            ]
          },
        ],
        paragraphs: []
    },
    {
        id: '2',
        chapterId: 'chapter-2',
        type: 'chapter',
        title: '工程概况',
        hasContent: true,
        loading:false,
        children: [],
        actions: ['continue', 'rewrite'],
        paragraphs: [
            {
                type:'text',
                content: `
                <p>本项目位于某市核心商业区，用地性质为商业用地。建设内容包括商业、办公、酒店等多种业态。</p>
                <p><strong>主要技术指标：</strong></p>
                `
            },{
                type:'table',
                content: [...tableTest]
            }
        ],
        
    },
    {
        id: '3',
        chapterId: 'chapter-3',
        type: 'chapter',
        title: '建筑设计',
        hasContent: true,
        loading:false,
        actions: ['continue', 'rewrite'],
        children: [
          {
            id: '3.1',
            chapterId: 'chapter-3-1',
            type: 'subchapter',
            title: '总平面设计',
            hasContent: true,
            loading: false,
            actions: ['continue', 'rewrite'],
            children: [],
            paragraphs: [
              {
                type: 'text',
                content: '<p>建筑布局遵循规划要求，主体建筑位于用地中心，周边设置环形消防车道，满足消防规范要求。地下设置两层地下车库，共设置机动车停车位450个。</p>'
              }
            ]
          },
          {
            id: '3.2',
            chapterId: 'chapter-3-2',
            type: 'subchapter',
            title: '平面设计',
            hasContent: true,
            loading: false,
            actions: ['continue', 'rewrite'],
            children: [],
            paragraphs: [
              {
                type: 'text',
                content: `
                  <p>建筑功能分区明确：</p>
                  <ul>
                    <li><strong>地下1-2层：</strong>设备用房及停车库</li>
                    <li><strong>1-3层：</strong>商业裙房，包含零售、餐饮等业态</li>
                    <li><strong>4-25层：</strong>办公区域，标准层面积约2000㎡</li>
                    <li><strong>26-30层：</strong>酒店客房及配套设施</li>
                  </ul>
                `
              }
            ]
          },
          {
            id: '3.3',
            chapterId: 'chapter-3-3',
            type: 'subchapter',
            title: '立面设计',
            hasContent: true,
            loading: false,
            actions: ['continue', 'rewrite'],
            children: [],
            paragraphs: [
              {
                type: 'text',
                content: '<p>立面采用现代简约风格，主要材料为玻璃幕墙、铝板幕墙。裙房与塔楼在体量和材质上形成对比，整体造型简洁大方。</p>'
              }
            ]
          },
          {
            id: '3.4',
            chapterId: 'chapter-3-4',
            type: 'subchapter',
            title: '防火设计',
            hasContent: true,
            loading: false,
            actions: ['continue', 'rewrite'],
            children: [],
            paragraphs: [
              {
                type: 'text',
                content: `
                  <p>建筑防火设计严格按照《建筑设计防火规范》GB 50016-2014执行：：</p>
                  <ul>
                    <li>建筑耐火等级为一级</li>
                    <li>每层设置两个独立疏散楼梯间，楼梯间为防烟楼梯间</li>
                    <li>疏散距离满足规范要求，最远疏散距离不超过30m</li>
                    <li>设置自动喷淋系统、消火栓系统及火灾自动报警系统</li>
                  </ul>
                `
              }
            ]
          },
        ],
        paragraphs: []
    },
    {
        id: '4',
        chapterId: 'chapter-4',
        type: 'chapter',
        title: '结构设计',
        hasContent: false,
        loading:false,
        actions: ['generate'],
        children: [],
        paragraphs: []
    },
    {
        id: '5',
        chapterId: 'chapter-5', 
        type: 'chapter',
        title: '给排水设计',
        hasContent: false,
        loading:false,
        actions: ['generate'],
        children: [],
        paragraphs: []
    },
    {
        id: '6',
        chapterId: 'chapter-6',
        type: 'chapter',
        title: '电气设计',
        hasContent: false,
        loading:false,
        actions: ['generate'],
        children: [],
        paragraphs: []
    },
    {
        id: '7',
        chapterId: 'chapter-7',
        type: 'chapter',
        title: '暖通设计',
        hasContent: false,
        loading:false,
        actions: ['generate'],
        children: [],
        paragraphs: []
    },
    {
        id: '8',
        chapterId: 'chapter-8',
        type: 'chapter',
        title: '节能设计',
        hasContent: false,
        loading:false,
        actions: ['generate'],
        children: [],
        paragraphs: []
    },
]


export const mockReferenceData = [
  {
    id:'1',
    title:'《商业综合体设计规程》GB 500XX-2020.docs',
    chunk:'参考了商业综合体的功能分区和交通组织要求，确保设计符合商业建筑的标准。',
  },
  {
    id:'2',
    title:'《建筑设计防火规范》GB 50016-2014（2018年版）.pdf',
    chunk:'参考防火分区、安全疏散、消防设施等相关条文，确保建筑消防安全设计符合规范要求。',
  },
  {
    id:'3',
    title:'《民用建筑设计统一标准》GB 50352-2019.xls',
    chunk:'参考建筑分类、设计基本规定、建筑模数协调等基础标准，确保设计的规范性和统一性。',
  },
  {
    id:'4',
    title:'《建筑结构荷载规范》GB 50009-2012.docx',
    chunk:'参考荷载取值标准，确保结构设计的安全性和经济性。',
  },
  {
    id:'5',
    title:'《混凝土结构设计规范》GB 50010-2010（2015年版）.pdf',
    chunk:'参考混凝土结构设计的基本原则和构造要求，指导结构设计和施工。',
  }  
]

//操作记录：时间-操作人-操作动作-操作对象-操作章节-操作状态
export const mockOperationRecord = [
  {
    time:'2025-11-1 10:00',
    subjectName:'设计师',
    action:'修改',
    objectName:'建筑面积',
    chapter:'项目概况',
    status:''
  },
  {
    time:'2025-10-3 11:00',
    subjectName:'AI',
    action:'生成',
    objectName:'内容',
    chapter:'项目概况',
    status:''
  },
  {
    time:'2025-10-4 9:00',
    subjectName:'设计师',
    action:'创建',
    objectName:'整体内容',
    chapter:'项目概况',
     status:''
  }  
]

const chapter1 = `# 1.设计依据：
## 1.1 工程设计有关批文
1.1.1 XXX市自然资源局XXX时间下发的《建设用地规划许可证》建字第XXX号；附规划设计条件和用地红线图。
1.1.2 XXX市自然资源局XXX时间下发的《建设工程规划许可证》建字第XXX号。
1.1.3 XXX市XXX局批复的《XXX》文件。
1.1.4 人防方面的批文。
1.1.5 我公司与XXX公司签订的设计合同，合同编号为XXX。 
## 1.2 现行国家和地方有关建筑设计的规范、标准和规定：
1.2.1 统一
a.《建筑工程设计文件编制深度规定》
b.《房屋建筑制图统一标准》GB/T 50001-2017
c.《建筑制图标准》GB/T 50104-2010
d.《民用建筑通用规范》GB 55031-2022
e.《民用建筑设计统一标准》GB 50352-2019
f.《建筑与市政工程无障碍通用规范》GB 55019-2021
g.《无障碍设计规范》GB 50763-2012
h.《建筑工程建筑面积计算规范》GB/T 50353-2013
i.《建筑设计防火规范》GB 50016-2014（2018年版）
j.《建筑防火通用规范》GB 55037-2022
1.2.2 规划
a.《城乡建设用地竖向规划规范》CJJ 83-2016
b.《城市用地分类与规划建设用地标准》GB 50137-2011
c.《城市道路交通设施设计规范》GB 50688-2011（2019年版）
d.《历史文化名城保护规划标准》GB/T 50357-2018
e.《城市居住区规划设计标准》GB 50180-2018
1.2.3 专用
a.《车库建筑设计规范》JGJ 100-2015
b.《汽车库、修车库、停车场设计防火规范》GB 50067-2014
c.《人民防空地下室设计规范》GB 50038-2005（2023年版）
d.《人民防空工程设计防火规范》GB 50098-2009
e.《人民防空防护设备（防护门类）通用技术要求》国人防建[2024]3号
1.2.4 公共建筑
a.《商店建筑设计规范》JGJ 48-2014
b.《饮食建筑设计标准》JGJ 64-2017
c.《宿舍、旅馆建筑项目规范》GB 55025-2022
d.《旅馆建筑设计规范》JGJ 62-2014
e.《图书馆建筑设计规范》JGJ 38-2015
f.《档案馆建筑设计规范》JGJ 25-2010
g.《宿舍建筑设计规范》JGJ 36-2016
h.《托儿所、幼儿园建筑设计规范》JGJ 39-2016（2019年版）
i.《中小学校设计规范》GB50099-2011
j.《体育建筑设计规范》JGJ 31-2003
k.《疗养院建筑设计规范》JGJ/T 40-2019
l.《剧场建筑设计规范》JGJ 57-2016
m.《电影院建筑设计规范》JGJ 58-2008
n.《博物馆建筑设计规范》JGJ 66-2015
o.《办公建筑设计标准》JGJ/T 67-2019
p.《科研建筑设计标准》JGJ 91-2019
q.《老年人照料设施建筑设计标准》JGJ 450-2018
r.《展览建筑设计规范》JGJ 218-2010
s.《文化馆建筑设计规范》JGJ/T 41-2014
t.《数据中心设计规范》GB 50174-2017
u.《物流建筑设计规范》GB 51157-2016
v.《综合医院建筑设计标准》GB 51039-2014（2024年版）
1.2.5 技术
a.《建筑环境通用规范》GB 55016-2021
b.《民用建筑工程室内环境污染控制标准》GB 50325-2020
c.《民用建筑热工设计规范》GB 50176-2016
d.《建筑节能与可再生能源利用通用规范》GB 55015-2021
e.《公共建筑节能设计标准》GB 50189-2015
f.《建筑玻璃应用技术规程》JGJ 113-2015
g.《玻璃幕墙工程技术规范》JGJ 102-2003
h.《民用建筑隔声设计规范》GB 50118-2010
i.《屋面工程技术规范》GB 50345-2012
j.《种植屋面工程技术规程》JGJ 155-2013
k.《坡屋面工程技术规范》GB 50693-2011
l.《建筑与市政工程防水通用规范》GB 55030-2022
m.《地下工程防水技术规范》GB 50108-2008
n.《建筑外墙防水工程技术规程》JGJ/T 235-2011
o.《混凝土小型空心砌块建筑技术规程》JGJ/T 14-2011
p.《预拌砂浆》GB /T 25181-2019
q.《墙体材料应用统一技术规范》GB 50574-2010
r.《蒸压加气混凝土制品应用技术标准》JGJ/T 17-2020
s.《绿色建筑评价标准》GB/T 50378-2019（2024年版）
t.《建筑防烟排烟系统技术标准》GB 51251-2017
u.《岩棉薄抹灰外墙外保温工程技术标准》JGJ/T 480-2019
## 1.3 设计任务书；与建设单位之间的往来函。
## 1.4 经建设单位确认的本工程方案设计文件（或初步设计文件）；
建设单位关于方案设计文件（或初步设计文件）的修改意见及施工图设计要求。`

const chapter2 = `# 2.工程概况：
## 2.1 工程名称：
XXX
## 2.2 工程地点：
XXX市XXX区，场地四周道路环境的简要描述；
## 2.3 工程规模：
用地面积:XXXm2
建筑面积：XXXm2
地上建筑面积XXXm2、地下建筑面积XXXm2
规划设计总高度XXXm、消防设计总高度XXXm
建筑层数：XX层
地上XX层、地下XX层
停车位：XXX辆，其中地上停车位XXX辆、地下停车位XXX辆、充电车位XXX辆
## 2.4 建筑类别：
2.4.1本工程结构形式为XXX结构。
2.4.2本工程抗震设防烈度为X度。
2.4.3 本工程建筑设计工作年限为50年。
2.4.4 本工程属于XXX民用建筑，裙房部分建筑高度不超过24米，地上部分和地下部分的设计耐火等级均为一级。
## 2.5 功能布局：
简述主要层的主要功能。
表格内容根据具体工程填写。`

const chapter3 = `# 3.建筑定位、设计标高及尺寸标注：
 ## 3.1 建筑定位：
本工程采用2000国家大地坐标系统，建筑定位详见建施-XX总平面图。
## 3.2 设计标高：
本工程±0.000标高相当于1985国家高程XXX米（此标高由建设单位提供，需现场复核确定与周边道路衔接无误后方可施工），室内外高差XXXm。
## 3.3 本套图纸的标注尺寸除特殊注明外，总平面布置图以米为单位，其他图纸长度单位为毫米，角度为度，标高为米。
## 3.4 本工程各层标注标高除特殊注明外均为完成面标高，屋面标高为结构标高。`

const chapter4 = `# 4.墙体工程：
## 4.1 材料及选型：
除特殊注明外，本工程墙体选型及材料如下：
4.1.1 外墙：地上外墙采用XXX厚XXX型XXX砌块（导热系数XXXw/(m.k)、容重XXXkg/m3），其构造由内至外为：190mm厚XX砌块、XXX保温层；地下室外墙采用防水混凝土墙体（设计抗渗等级Px），XXX保温层兼防水保护层。具体位置详见建施平面图。
4.1.2 内墙：地上内墙采用XXX厚XXX型XXX砌块（导热系数XXXw/(m.k)、容重XXXkg/m3）；地下内墙采用XXX厚XXX型XXX砌块（导热系数XXXw/(m.k)、容重XXXkg/m3）。具体位置详见建施平面图。
4.1.3 所有卫生间、茶水间等经常有水房间墙体采用XXX厚XXX型XXX砌块。4.1.4 砌筑砂浆采用预拌砂浆（蒸压加气混凝土砌块砌筑砂浆采用专用配套砂浆或专用粘结剂），砌块和砌筑砂浆的强度等级详见结施图纸。砌块应满足《XXX》相关要求。
（如个别项目要求可在建筑说明中写明：砂浆粘结强度不小于XXXMpa，砌筑砂浆的强度等级不得低于MXXX；外墙砌块强度等级XXX，内墙砌块强度等级XXX）。
## 4.2 构造要求：
4.2.1 除特殊注明外所有隔墙顶部均需砌筑至结构板底。
4.2.2 墙体拉结钢筋、圈梁、过梁和构造柱的设置详见结施图纸和说明。
4.2.3 墙体上门窗洞口四周宜采用实心砌块砌筑，门窗框的固定方式、沟槽设置、墙体挂件和固定件的安装等均应满足生产厂家的产品要求（采用特殊砌块时构造做法按照相关要求，如自保温砌块）。
4.2.4 所有室内管井外壁均应于管道安装后砌筑；有机电管道穿过的内隔墙先砌筑至管道底标高以下100mm处，待管道安装后砌筑到顶，并做好防火封堵。
4.2.5 配电箱、消火栓箱等洞口穿透墙体时，箱体背部需用砌块砌筑封堵或加铺钢板并喷涂防火涂料（或采用大于15mm厚硅酸钙板），耐火极限同该墙体，钢板周边大于洞口150mm，面层同所在墙面。穿墙管道预留洞待管道安装完毕后，用C20细石混凝土填实；墙体上的留洞与管道间隙应以与墙体耐火极限相同的材料封堵。
4.2.6 凡与钢筋混凝土交接的小于100mm的墙垛，均用C20钢筋混凝土浇筑。
4.2.7 砌体与混凝土墙、柱的拉结做法详见结施图纸。
4.2.8 蒸压加气混凝土砌块墙体上固定设备时，应在相应固定高度处加设不小于200mm高的C25细石混凝土带，长度大于设备固定部件两边各100mm（其他墙体按照相应要求描述）。
## 4.3 墙体防水和防潮见本说明防水设计章节。
## 4.4 其他未注明构造按照国标图集《混凝土小型空心砌块填充墙建筑、结构构造》22J 102-2，《蒸压加气混凝土砌块、板材构造》13 J104，《轻集料空心砌块内隔墙》03J 114-1……中的要求执行。未尽事宜，按照相关施工及验收规范执行。`


const chapter5 = `# 5.屋面工程：
## 5.1 设计依据：
a.《屋面工程技术规范》GB 50345-2012
b.《种植屋面工程技术规程》JGJ 155-2013
c.《坡屋面工程技术规范》GB 50693-2011
d.《压型金属板工程应用技术规范》GB 50896-2013
e.《建筑与市政工程防水通用规范》GB55030-2022
## 5.2 屋面防水和排水设计见本说明防水设计章节。
## 5.3 钢筋混凝土屋面构造做法：
详见建施-X《装修、构造做法表》和节点详图，并满足以下要求：
5.3.1保护层：配筋细石混凝土保护层与女儿墙、山墙交接处留30mm宽缝隙并填嵌合成高分子密封材料；板中留横竖分格缝，分格缝间距≤6m，缝宽20mm，钢筋网片断开，缝内填嵌合成高分子密封材料。
5.3.2 屋面保温材料厚度及物理性能详见节能设计专篇，屋面保温层施工时，应保证基层平整。
5.3.3 找坡层：采用轻骨料混凝土找坡（抗压强度≥0.3Mpa），水泥砂浆找平，找坡层上的防水找平层及防水保护层应设分格缝，其纵向间距不大于3m，缝宽6mm，缝内加聚苯乙烯泡沫条背衬。
5.3.4 本工程的XX部位屋面设置隔汽层，其构造见《装修、构造做法表》中屋面XX，隔气层材料采用与防水层相配套的材料，或采用涂膜防水层施涂于屋面结构板基层兼做隔汽层，铺设隔汽层时，在屋面与墙面连接处应沿墙面向上铺设并与屋面的防水层连接,形成全封闭的整体。
## 5.4 金属屋面的构造详见专业厂家图纸，厂家应使金属屋面达到设计的承载、保温、防火、防水和隔声等要求，做好该屋面构件与土建部分的连接，并向土建设计单位提供埋空的设计要求。`

const chapter6 = `# 6.楼地面工程：
## 6.1 楼地面做法详见建施-X《装修、构造做法表》和节点详图。
## 6.2 楼层和地面防水防潮见本说明防水工程章节。
## 6.3 管井门做混凝土门槛，高150mm或同该处踢脚高。风井穿楼板时周边做C15混凝土槛150mm高，宽度同井壁厚。
## 6.4 地下室消防水泵房、变电所和消防控制室等设备用房门下方设150mm（高）x200mm（宽）细石混凝土挡水门槛。
## 6.5 防水楼地面找坡均坡向地漏。地漏四周应做加强防水层，加强层宽度不小于150mm，防水层在地漏收头处用合成高分子密封胶进行密封防水处理。
## 6.6 楼地面回填土应该分层夯实，人工夯实每层厚度不大于200mm。`

const chapter7 = `# 7.门窗、隔断工程：
## 7.1 本工程内外门窗、隔断的材料、颜色、开启方式和耐火等级详见建施门窗表。
## 7.2 门窗立面图、玻璃隔断立面图仅表示门窗、隔断的立面分格示意及开启方式，其型材构件尺寸、截面大小、构造节点和安装图等应由生产厂家进行深化设计并满足强度、抗风、防水、保温、气密、水密等相关要求。
## 7.3 门窗表中的尺寸为门窗洞口尺寸，门窗加工尺寸应参照门窗立面图和装修面厚度由承包商予以调整，并经实地测量核对数量后再加工制作。
## 7.4 所有木门制作时木材均需进行干燥处理，含水率限值为：
门窗扇15%，门窗框18%。木门油漆均先刷底子油一道，满刮腻子一道，砂纸打平后再刷调和漆二道，颜色待定。
## 7.5 室内玻璃隔断临空位置应选用夹层安全玻璃，普通玻璃隔断选用钢化玻璃，无框玻璃外露边缘应切角并打磨光滑。
## 7.6 全玻璃门及落地窗、走道两侧的玻璃墙体应在距地0.85~1.50m高度设醒目的防撞提示标志。
## 7.7 门窗玻璃的选用应遵照《建筑玻璃应用技术规程》JGJ113-2015和《建筑安全玻璃管理规定》（发改运行[2003]2116号文件）及地方主管部门的有关规定。
## 7.8 依据《建筑幕墙、门窗通用技术条件》GB/T31433-2015、《建筑外门窗气密、水密、抗风压性能检测方法》GB/T7106-2019，本项目外门窗的主要性能如下（具体数据依据工程情况确定；部分地区要求明确气密、水密、抗风压具体数值时根据要求描述）：
a.保温性能不低于6级，具体指标见节能设计专篇；
b.气密性不低于6级；
c.水密性不低于3级；
d.抗风压性能不低于3级；
e.空气声隔声性能不低于3级；
## 7.9 可开启外窗中，不便手动直接开启的，应在距地面高度1400mm处设置手动开启装置；可开启外窗配置安全开启角度调节装置；楼梯间顶部的常闭式应急排烟窗应具有手动和联动开启功能。
## 7.10 除精装修区域及图中注明内墙为瓷砖墙面、库房、设备用房等房间外，内窗台均设置20mm厚石英石窗台板（根据项目需求酌情写）。`

const chapter8 = `# 8.幕墙、天窗、玻璃雨棚工程：
## 8.1 玻璃幕墙为框架式明框（隐框）玻璃幕墙，框材采用隔热断桥铝型材（内外氟碳喷涂），玻璃为10mm钢化+12A+8mm钢化low-e中空玻璃（经幕墙公司计算后确定），玻璃幕墙的反射比不应大于0.3，玻璃透光率不应小于0.4；金属幕墙为铝合金幕墙及穿孔铝合金幕墙；陶土板幕墙为30mm厚陶土板幕墙及50x50方陶管幕墙（表面非抛光），具体颜色见立面及门窗立面分格示意图。
## 8.2 玻璃幕墙的设计、制作和安装应满足现行《建筑幕墙》GB/T 21086-2007和《玻璃幕墙工程技术规范》JGJ 102-2003的相关要求；金属幕墙的设计、制作和安装应满足现行《建筑幕墙》GB/T 21086-2007和《金属与石材幕墙工程技术规范》JGJ 133-2001的相关要求。
## 8.3 幕墙玻璃应执行现行《建筑玻璃应用技术规范》JGJ 113-2015及《建筑安全玻璃管理规定》（发改运行[2003]2116号文件）。
## 8.4 本工程幕墙立面图仅表示立面形式、分格尺寸、开启方式、颜色和材质要求，玻璃幕墙的风压变形、雨水渗透、空气渗透、平面内变形、保温、隔声等性能应由玻璃幕墙深化设计单位根据XXX市的地理、气候、建筑物高度、体型及环境条件进行设计，以保证符合国家现行相关标准的规定。
## 8.5 幕墙的安装需幕墙深化设计单位依据本套图纸关于幕墙的节点要求，做好防水、防火、防雷、保温等密闭设计及安装处理，并在主体结构施工前，提供主体结构上预埋件设计图。幕墙的主龙骨应连接在结构受力构件上。
## 8.6 幕墙工程应满足防火墙两侧、窗间墙、窗槛墙的防火要求，幕墙与每层楼板、隔墙处的缝隙应采用防火封堵材料封堵，防火封堵构造详建施XXX节点XXX或参见XXX标准图。
## 8.7 依据《建筑幕墙、门窗通用技术条件》GB/T 31433-2015，本项目玻璃幕墙的主要性能如下（具体数据依据工程情况确定）：
a.保温性能不低于6级，具体指标见节能设计专篇；
b.气密性不低于3级；
c.水密性不低于3级；
d.抗风压性能不低于3级；
e.空气声隔声性能不低于3级；
## 8.8 玻璃幕墙非透明部分内衬2mm厚铝单板。
## 8.9 玻璃幕墙的外开启扇应采取防脱落措施，具体详厂家二次设计。
## 8.10 玻璃采光顶由专业厂家二次设计，应符合《建筑玻璃采光顶技术要求》JG/T231-2018的要求。采光顶玻璃采用夹层玻璃或夹层中空玻璃，其胶片厚度不应小于0.76mm，且夹层玻璃应位于下侧，并设置防止玻璃整体脱落的措施。采光顶下部应设置冷凝水导泄装置，采取防冷凝水产生的措施。
## 8.11 玻璃雨棚应符合《建筑玻璃采光顶技术要求》JG/T231-2018的要求。玻璃采用夹层玻璃或夹层中空玻璃，其胶片厚度不应小于0.76mm，玻璃选用自洁净安全玻璃。（汽车库外墙门、洞口上方玻璃雨棚耐火极限不小于1.0h）`

const chapter9 = `# 9.装修工程：
## 9.3 内外装修选用的各项材料其材质、规格、颜色等，均由施工单位提供样板，经建设和设计单位确认后进行封样，并据此验收。`

const chapter10 = `# 10.电梯工程：
## 10.1 本工程选用垂直电梯共XX台（其中消防电梯XX部，无障碍电梯XX部）；自动扶梯XX部。
## 10.2 电梯的参数，包括载重、速度、底坑深度、顶站高度的等见电梯选用表。
## 10.3 预埋件及机房预留孔详见具体电梯厂家技术图纸；电梯井道尺寸、底坑尺寸等与设备安装有关的土建尺寸，应该由所选用电梯厂家确认无误后方可施工。垂直电梯井道中间钢梁的设计和材料由电梯厂家负责，安装垂直电梯和扶梯的预埋件和预留孔洞由电梯厂家负责提供和施工配合。电梯的制造与安装须符合《电梯制造与安装安全规范》GB/T 7588-2020的相关规定。
## 10.4 所有电梯产品均应具备节能运行的功能，垂直电梯采取（群控、变频调速或能量反馈等）的节能措施，自动扶梯、自动步道采取（变频感应启动等）的节能措施。
## 10.5 消防电梯应满足《消防员电梯制造与安装安全规范》GB/T 26456-2021，以及《建筑设计防火规范》GB50016-2014（2018年版）第7.3.8条的要求。
## 10.6 无障碍电梯的轿厢及侯梯厅应满足《建筑与市政工程无障碍通用规范》GB55019-2021第2.6节及《无障碍设计规范》GB50763-2012第3.7节的要求。
## 10.7 轿厢内部装修要求详见精装修图纸或提出具体要求。电梯层门的耐火极限不应低于1小时,耐火完整性不低于2小时；满足消防电梯要求的普通电梯其内部装修应采用不燃材料。
## 10.8 电梯选型表：
## 10.8 电梯选型表：
| 编号 | 载重量（t） | 速度（m/s） | 井道尺寸（宽x深）（mm） | 底坑深（mm） | 顶站高度（mm） | 层站 | 提升高度（m） | 对重安全钳 | 控制方式 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
自动扶梯、自动步道选型表：
| 名称 | 编号 | 倾斜角度（゜） | 梯级宽度（mm） | 速度（m/s） | 输送能力（人/h） | 护壁板特征 | 提升高度（m） | 水平距离（mm） | 扶手颜色 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
自动扶梯、自动步道选型表：

| 名称 | 编号 | 倾斜角度（゜） | 梯级宽度（mm） | 速度（m/s） | 输送能力 （人/h） | 护壁板特征 | 提升高度（m） | 水平距离（mm） | 扶手颜色 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 自动扶梯 | 1 | 30 |  |  |  |  |  |  |  |  |
| 自动步道 | 2 | 11 |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |`

const chapter11 = `## 11.1 设计依据：
a.《建筑防火通用规范》 GB 55037-2022
b.《建筑设计防火规范》GB 50016-2014（2018年版）
c.《人民防空工程设计防火规范》GB 50098-2009
d.《汽车库、修车库、停车场设计防火规范》GB 50067-2014
e.《建筑内部装修设计防火规范》GB 50222-2017
f.《消防设施通用规范》GB 55036-2022
g.《建筑防烟排烟系统技术标准》GB 51251-2017
国家及地方现行消防有关技术规范和文件
## 11.2 建筑分类和耐火等级：
本项目总建筑面积为 XXX㎡，地下X层，地上 X层，建筑消防高度为XX米。为一类高层公共建筑，地上耐火等级为一级；地下耐火等级为一级。
## 11.3 总平面布局：
11.3.1 周边环境状况：本工程东侧、南侧为多层建筑，西侧、北侧为高层建筑。建筑占地面积为XXX平方米，消防车能到达建筑的两条长边。
11.3.2 防火间距：本工程与相邻多层建筑间距均满足间距大于9m，高层建筑建筑间距均满足间距大于13m。
11.3.3 场地内的道路均符合消防车道的要求：道路最小宽度4m，上部净空高度均大于4m，转弯半径满足消防车转弯要求，车道坡度不大于10%。车道与建筑之间无妨碍消防车操作的障碍物，靠建筑外墙一侧的边缘距离建筑外墙不小于5米。消防车道的路面及其下面的建筑结构、管道、管沟等满足承受消防车满载时压力的要求。
11.3.4 本工程在X侧设置消防车登高操作场地，场地长XXm、宽XXm，靠建筑外墙一侧的边缘距离建筑外墙不小于5m，不大于10m；坡度不大于3%，与建筑之间无妨碍消防车操作的障碍物和出库出入口；该区域设有直通楼梯间的安全出口；场地及其下面的建筑结构、管道、管沟等满足承受消防车满载时压力的要求。
## 11.4 防火分区：
11.4.1本工程整体设置火灾自动报警和自动喷水灭火系统，防火分区划分的原则如下：地下室设备用房每个防火分区面积不超过2000㎡；地下车库每个防火分区面积不超过4000㎡；地上各层，每个防火分区面积不超过3000㎡。
11.4.2 地下部分：本工程地下X层，建筑面积XXX㎡，共分为X个防火分区。其中XXX部分防火分区面积为XXX㎡，设备用房区防火分区面积为XXX㎡。防火分区之间采用耐火极限大于3小时的防火墙、甲级防火门作防火分隔。
11.4.3 地上部分：本工程地上X层，建筑面积共XXX㎡，共分为X个防火分区。其中地上X层平面主要布置XXX、XXX及相关配套用房等功能。一至X层每层设4部封闭楼梯间，每层为1个防火分区，每个防火分区面积均不超过 3000㎡。其中，一层防火分区包含一层平面以及中庭上下通高部分，二层及以上防火分区面积与中庭挑空相连部分，均采用防火卷帘进行防火分隔。
## 11.5 防烟分区：
每个防烟分区面积不大于1000㎡，最大允许长度不大于36m。分隔方式主要有挡烟垂壁、隔墙、梁。
## 11.6 安全疏散：
11.6.1 安全出口设计：地下部分共有X个防火分区，其中XXX部分的防火分区共有两个直通室外的人员安全出口，且两个安全出口之间距离大于5m；设备用房部分防火分区面积为XXX㎡，共有两个安全出口，其中一个为直通室外的安全出口，另一个安全出口利用通向相邻防火分区的甲级防火门，且甲级防火门疏散净宽度不大于本防火分区所需疏散总净宽度的30%。地上部分每层为一个防火分区，各层分别设置X部疏散楼梯，疏散楼梯均为防烟楼梯间，满足疏散要求，所有安全出口之间距离均大于5m。
11.6.2 疏散距离设计：本项目建筑整体设置火灾自动报警和自动喷淋灭火系统，安全疏散距离可增加25%，房间内任一点至最近疏散门或安全出口的直线距离≤25.0m，其他位于两个安全出口间的房间疏散门到最近安全出口直线距离≤50.0m，位于袋形走道两侧或尽端的房间疏散门距离最近安全出口直线距离≤25.0m，本项目室内各层疏散距离均满足规范要求。
11.6.3 安全疏散宽度：本项目地上共X层，疏散宽度原则均按照 1m/100 人计算。最不利层为二层，单层最大人数XXX人，疏散宽度应为XXXm，XX层每层设计总疏散宽度为XXm，满足规范要求。本工程首层直接对外安全出口设计总宽度为 XXm，满足规范要求。安全疏散楼梯最小净宽度为1.1m（特殊类型如医疗建筑等应按照相关规范要求描述），首层每个疏散外门最小净宽度为1.1m，均满足规范中疏散走道、首层疏散外门、公共建筑中的室内疏散楼梯的净宽度均不小于1.1m要求。
11.6.4 疏散楼梯设计：本工程地下设X部封闭楼梯间，楼梯间首层直通室外，楼梯间的门为乙级防火门，楼梯间顶部或者最上层外墙设置面积不小于1.0㎡的手动和联动控制常闭式应急排烟窗。地上设X部防烟楼梯间，楼梯间的首层设直接对外出口。防烟楼梯间及其前室的门均为乙级防火门，楼梯间顶部或者最上层外墙设有面积不小于1.0㎡的手动和联动控制常闭式应急排烟窗。
## 11.7 救援设施和消防控制室：
11.7.1消防救援操作场地范围内设有净高度和净宽度均不小于1m的消防救援口。下沿距室内地面不大于1.2m，间距不大于 20m，且每个防火分区不少于2个，窗口的玻璃易于破碎，设置可在室内外易于识别的永久明显标志。
11.7.2 本项目共设X部消防电梯，在首层入口处设置明显标识和供消防救援人员专用的操作按钮，消防电梯前室最小净宽不小于2.4m。
11.7.3 本项目消防控制室、消防水泵房位于地下一层，疏散门直通安全出口，并设防水淹门槛。
## 11.8 防火构造：
11.8.1 外墙：为外保温墙体，200mm厚高精度蒸压砂加气混凝土砌块，其构造由内至外为：200mm厚高精度蒸压砂加气混凝土砌块、100mm厚憎水岩棉板（燃烧性能A级）。
11.8.2 内墙：地下室为200mm厚混凝土小型空心砌块墙；地上各层一般隔墙为 200/100mm厚高精度蒸压砂加气混凝土砌块。
11.8.3 防火墙：地下室为200mm厚普通混凝土小型空心砌块，用页岩陶粒或矿渣灌实孔洞，地上各层为200mm厚高精度蒸压砂加气混凝土砌块，耐火极限不小于3小时。防火墙应直接设置在建筑的基础或框架、梁等承重结构上，框架、梁等承重结构的耐火极限不应低于防火墙的耐火极限。
11.8.4 楼板：为120mm厚钢筋混凝土板，其耐火极限大于1.50h。
11.8.5 屋面：屋面保温采用 100mm 厚挤塑聚苯板，燃烧性能为 B1 级。
11.8.6 门窗：本工程通风、空调机房，消防控制室和变配电室的门为甲级防火门，采用耐火极限不低于2.00h的防火隔墙和1.50h的楼板与其他部位分隔；楼梯间的门为乙级防火门，库房或储藏间设乙级防火门，其他设备房间的门为乙级防火门；管道井的门为丙级防火门（埋深大于10m的地下室、超高层建筑的管井门为甲级防火门），且所有的甲、乙级防火门带有观察窗。用于疏散走道上的防火门为常开防火门，具有火灾自行关闭功能。防火门分甲、乙、丙三级，其耐火极限分别为 1.5h、1.0h 及 0.5h。平开防火门设闭门器，双扇防火门增设顺序器，常开防火门须安装信号控制和反馈装置。防火门、窗符合《防火门》GB 12955-2024及《防火窗》GB 16809-2024（暂未实施，旧的项目仍依据原标准）的规定。
11.8.7 防火卷帘：具有火灾时靠自重自动关闭功能，耐火极限不低于所设置部位墙体的耐火极限要求。防火卷帘具有防烟性能，与楼板、梁、墙、柱之间的空隙采用防火封堵材料封堵，在火灾时自动降落的防火卷帘，具有信号反馈的功能。防火卷帘符合《防火卷帘》GB 14102.1-2024（2025.05月实施）的规定。
11.8.8 挡烟垂壁：地上采用500mm高（根据储烟仓高度确定，余同）防火玻璃成品挡烟垂壁，地下部分采用500mm高1.5mm厚热镀锌铁板（采用电动式挡烟垂壁，火灾时垂下高度500mm）（或利用大于500mm高度的结构梁）。
11.8.9 玻璃幕墙在每层楼板处作不燃烧体墙裙和防火封堵，高度0.8m（未设自动喷水灭火系统时为1.2m、超过250米的超高层为1.5m），不燃烧体墙裙和防火封堵材料的耐火极限不低于外墙的要求。
11.8.10 管道井在管道安装完毕后在每层楼板标高处二次浇筑混凝土（耐火极限同楼板）做防火分隔，管道井与房间、走道等相连通的孔隙应采用防火封堵材料封堵。
## 11.9 装修材料：
建筑内部装修材料的选择须符合《建筑内部装修设计防火规范》GB 50222-2017、《建筑防火通用规范》GB 55037-2022 中对材料燃烧性能等级的要求。地下建筑顶棚采用A级装修材料，地面采用A级装修材料，水平疏散走道和安全出口墙面采用 A 级装饰材料。地上建筑的水平疏散走道和安全出口的门厅顶棚、墙面采用 A 级装饰材料，地面采用不低于B1级装饰材料。`

const chapter12 = `# 12.无障碍设计：
## 12.1设计依据：
a.《建筑与市政工程无障碍通用规范》GB 55019-2021
b.《无障碍设计规范》GB 50763-2012
c.《无障碍设施施工验收及维护规范》GB 50642-2011
## 12.2 场地无障碍设计：
12.2.1 人行道和台阶处设置盲道，盲道纹路凸出路面4mm，行进盲道的起点、终点、转弯处设置提示盲道。
12.2.2 路口、出入口和人行横道高差处设置缘石坡道，坡度不应大于1：20，顶端留有宽度不小于900mm的过渡空间，距坡道下口路缘石250mm～300mm处应设置与缘石坡道的宽度相对应的提示盲道。
## 12.3 无障碍机动车位：
12.3.1 本工程共设无障碍机动车位XX个，其中地面车位XX个，地下车位XX个。
12.3.2 落客区的尺寸为2.40m×7.00m，停车位一侧设宽度不小于1.20m的轮椅通道。
12.3.3 停车位的地面设置停车线、轮椅通道线和无障碍标志，并设置引导标识。
## 12.4无障碍通道：
12.4.1 室内通道通行净宽不小于1.20m，室外通道通行净宽不小于1.50m。
12.4.2 通道上井盖、箅子孔洞的宽度或直径不大于13mm，条状孔洞垂直于通行方向。
12.4.3自动扶梯、楼梯的下部和其他室内外低矮空间在净高不大于2.00m处设置安全阻挡标识。
## 12.5 无障碍出入口：
12.5.1 无障碍出入口位于建筑主入口处，设置纵向坡度1：12的轮椅坡道，轮椅坡道的临空侧设置高度50mm的安全挡台。
12.5.2 室外平台处门完全开启后净深度不小于1.50m。
12.5.3 门斗两道门除去门扇摆动的空间后净间距不小于1.50m。
## 12.6 无障碍电梯：
12.6.1 候梯厅电梯口呼叫按钮前设置提示盲道。
12.6.2 候梯厅呼叫按钮的中心距地面高度0.85m～1.10m，且距内转角处侧墙距离不应小于400mm，按钮应设置盲文标志。
12.6.3 电梯轿厢深度不小于1.40m，宽度不小于1.10m，内设电梯运行显示装置和报层音响，轿厢侧壁上设高0.90m-1.10m带盲文的选层按钮，轿厢的三面壁上设高850mm-900mm符合无障碍设计要求的扶手，轿厢正面高900mm处至顶部安装镜子。
12.6.4候梯厅深度不小于1.80m；电梯门开启后的通行净宽不小于900mm，完全开启时间保持不小于3s。
## 12.7 无障碍卫生间：
12.7.1卫生间门净宽不小于900mm，为水平滑动门，门把手一侧墙面宽度不小于500mm，门内外高差15mm，以坡度1：10斜面过渡。
12.7.2 内部满足直径1.50m的轮椅回转空间，设置满足规范要求的无障碍坐便器、无障碍洗手盆、多功能台、低位挂衣钩和救助呼叫装置。
## 12.8 无障碍使用的门：
12.8.1平开门外侧和里侧均应设置扶手，扶手应保证单手操作，操作部分距地面高度应为0.85m～1.00m。
12.8.2 玻璃门应选用安全玻璃并应采取醒目的防撞提示措施；防撞提示应横跨玻璃门或隔断，距地面高度应为0.85m～1.50m。
12.8.3 安装有闭门器的门，从闭门器最大受控角度到完全关闭前10°的闭门时间不应小于3s。
12.8.4 双向开启的门应在可视高度部分安装观察窗，通视部分的下沿距地面高度不应大于850mm。
## 12.9无障碍标识：
无障碍道路、机动车位、通道、出入口、电梯、卫生间和设置无障碍设施的位置及走向应设置满足相关规范要求的标识。
## 12.10其他：
低位挂衣钩、低位毛巾架、低位搁物架等无障碍服务设施待建筑工程验收合格后，由使用单位自行安装。`

const chapter13 = `# 13.防水设计：
## 13.1设计依据：
a.《建筑与市政工程防水通用规范》GB55030-2022
b.《地下工程防水技术规范》GB50108-2008
c.《屋面工程技术规范》GB50345-2012
d.《种植屋面工程技术规程》JGJ155-2013
e.《坡屋面工程技术规范》GB50693-2011
f.《建筑外墙防水工程技术规程》JGJ/T235-2011
g.《建筑气候区划标准》GB50178-93
h.《屋面工程质量验收规范》GB50207-2012
i.《地下防水工程质量验收规范》GB50208-2011
j.《压型金属板工程应用技术规范》GB50896-2013
......
## 13.2工程与使用环境概况：

| 建设地点 | 沈阳市 | 建筑性质 | 公共建筑 |
| --- | --- | --- | --- |
| 气候分区 | 严寒（C）区 | 年降雨量 | 600mm |
| 抗浮设防水位 | -5.800m | 地下室层数/埋深 | 地下3层/-15.2m |
| 屋面类型 | 现浇钢筋混凝土平屋面/现浇钢筋混凝土坡屋面/金属屋面 | 外墙类型 | 现浇或预制钢筋混凝土外墙/混凝土小型空心砌块填充墙/蒸压加气混凝土外墙板/玻璃幕墙 |
| 室内防水部位 | 卫生间/淋浴间/厨房/用水设备用房/垃圾间/ | 室内水池类型 | 生活水池/游泳池/消防水池 |

## 13.3分部位防水设计：

| 类别 | 设计工作年限 （年） | 防水 等级 | 防水设 防层数 （道） | 防水层材料 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 地下室 | 50/=结构设计工作年限 | 一 | 3 | 防水混凝土+防水卷材2道 /防水混凝土+防水卷材1道+防水涂料1道/防水混凝土+防水卷材1道+水泥基防水材料1道/防水混凝土+防水涂料1道+水泥基防水材料1道 |  |
| 屋面 | 20 | 一 | 3 | 防水卷材2道+防水涂料1道/防水卷材1道+防水涂料2道 |  |
| 外墙 | 同外墙装饰 | 一 | 2 | 防水砂浆1道+防水涂料1道 |  |
| 室内水湿房间楼地面 | 25 | 一 | 2 | 防水涂料1道+水泥基防水材料1道 |  |
| 室内水湿房间墙面 | 25 | / | 1 | 防水涂料1道/水泥基防水材料1道 |  |
| 室内水池、泳池 | 10 | 二 | 2 | 防水混凝土+防水涂料1道/防水混凝土+水泥基防水材料1道 |  |

## 13.4 地下室防水：
13.4.1 结构主体防水做法：地下室底板、侧墙和无地上建筑的地下室顶板全部为防水混凝土，厚度大于250mm，抗渗等级为P8（严寒和寒冷地区抗冻设防段防水混凝土抗渗等级不低于P10），混凝土强度大于C25。
13.4.2 防水材料和构造做法详建施-XX构造做法表和建施-XX节点图。（防水做法的组合可暂时参见23J909相关做法）
13.4.3 施工缝做法：施工缝设中埋式钢板止水带及外贴式止水带，顶板处采用防水卷材附加层替代外贴式止水带并与侧墙上外贴止水带连接，在迎水面设置附加防水卷材，做法参见《地下建筑防水构造》10J301第45页1、2、3节点。
13.4.4 后浇带做法：采用补偿收缩防水混凝土浇筑，采用超前止水后浇带做法，抗渗等级同两侧混凝土，强度比两侧混凝土提高一级，在后浇带的迎水面设置外贴式止水带，顶板处采用防水卷材附加层替代外贴式止水带并与侧墙上外贴止水带连接。做法参见《地下建筑防水构造》10J301第50页1、2、3节点。
13.4.5 桩头防水做法：做法参见《地下建筑防水构造》10J301第59页1、2节点。
13.4.6 群管穿墙防水做法：做法参见《地下建筑防水构造》10J301第55页节点。
13.4.7 地下室外墙防水设防范围应高出室外地坪不小于300mm；种植式地下室顶板与地上建筑相邻部位设置泛水，且高出覆土或者场地不应小于500mm。
13.4.8 地下室集水坑、电梯基坑排水沟的内壁抹聚合物水泥砂浆20mm厚，排水沟纵向坡度不小于0.2%。
13.4.9 地下室侧墙防水层外侧设80mm厚挤塑聚苯板保温层兼做防水保护层，构造做法见建施-XX节点图纸。
## 13.5 屋面防水：
13.5.1 屋面防水材料和构造做法详建施-XX构造做法表和建施-XX节点图。（建议构造表将一道涂膜类防水直接做在结构基层上，可兼做隔汽层；防水材料的组合选用暂时可参考《工程做法》23J909）
13.5.2 本工程屋面采用有组织排水系统，当采用平屋面及种植屋面时屋面排水坡度≥2%，采用金属屋面时排水坡度≥5%；混凝土屋面檐沟、天沟的纵向坡度不小于1%；出屋面机房等屋面采用平屋面有组织外排水系统，排水坡度为2%。坡向及雨水口位置见建施-xx屋面排水示意图（溢流设施与给水排水专业配合确定是否设置，结合建筑自身的要求选择女儿墙预留、天沟预留或者采用溢流管道系统，在说明中描述。女儿墙溢流口底建议距屋面完成面高度200mm）。
13.5.3 屋面柔性防水层在女儿墙和突出屋面结构的交接处均做距完成面大于250mm高的泛水，屋面转角处、天沟、水落口周围及屋面设施下部等处做卷材附加层，每边250mm；出屋面管道或泛水以下穿墙管安装后用细石混凝土封严，管根四周与找平层及刚性防水层之间留凹槽嵌填密封材料，管道周围的找平层加大排水坡度并增设柔性防水附加层与防水层固定密封，内排水落水口周围500mm直径范围内坡度不小于5%。雨水斗应安装钢制网，在施工中严防杂物进入。
13.5.4 屋面泛水做法见建施-XX图纸；屋面设施基座应做防水，做法详见屋面节点详图；高低跨屋面设有组织外排水时，在雨水管下方的低屋面铺设细石混凝土水簸箕。
13.5.5 女儿墙内侧及混凝土压顶（也可做金属压顶）做聚合物水泥砂浆防水，设分格缝，并填嵌密封材料，分格缝间距3m。压顶向内找坡，坡度5%。外墙防水延伸至压顶内侧滴水线部位。（采用金属压顶时，外墙防水层应做到压顶的顶部）
13.5.6 屋面防水工程的施工应选择经资质审查合格的专业防水施工队伍。
## 13.6外墙防水和防潮：
13.6.1 外墙防水构造做法详建施-XX构造做法表和建施-XX节点图。砌体外墙设置2道防水，现浇混凝土外墙设置1道防水。（有外保温的外墙防水做法暂参考《工程做法》23J909第6-2页3.3.3条）
13.6.2 封闭式幕墙满足水密性和气密性相关要求，其防水构造详见幕墙设计图纸。
13.6.3 门窗框与墙体间的缝隙采用聚合物水泥砂浆或发泡聚氨酯填充，外墙柔性防水层应延伸至门窗框，刚性防水层与门窗框间应预留凹槽，并应嵌填密封材料，门窗上楣的外口应做滴水线。内外窗台高差20mm，外窗台处应设置排水板和滴水线，排水坡度不应小于5%，且不应遮挡窗框排水孔。门窗性能和安装质量应满足水密性要求。
13.6.4 突出墙面的线脚、挑檐等上部与墙面交接处用防水砂浆做成小圆角并向外找坡2%。
13.6.5 雨棚设置外排水，坡度不小于1%，且外口下沿应做滴水线。雨棚与外墙的防水应连续，且防水层应沿外口下翻至滴水线。
13.6.6 开敞式阳台、设备平台的楼面设防水层，坡向水落口的排水坡度不小于1%，并应通过雨水立管接入排水系统，水落口周边应留槽嵌填密封材料。开敞式阳台、设备平台外口下檐做滴水线。
13.6.7 穿过外墙防水层的管道、螺栓、构件等需预埋，预埋件四周留凹槽，并嵌填防水密封材料。外墙面通风口、空调口、设备洞口及其他洞口底面应向室外倾斜，其坡度应不小于5%，或采取防雨水倒灌的措施。
13.6.8 穿过外墙的空调冷凝水套管采用DN75硬质PVC管材，内高外低倾斜角度为10゜。柜式空调预留套管中心距地150mm，挂式空调预留套管中心距地2200mm；空调冷凝水立管采用DN50硬质UPVC管材。（通常采用分体空调时需要预留，公建不多见）
13.6.9 外墙变形缝部位应采取防水加强措施。当采用增设卷材附加层措施时，卷材两端应满粘于墙体，满粘的宽度不应小于150mm,并应钉压固定，卷材收头应用密封材料密封。
13.6.10 外墙防水层应与地下墙体防水层搭接。与土壤接触的外墙宜设置散水，散水宽度大于900mm。
13.6.11 所有室内外砌体（有地下室和地梁者除外）均在首层室内地坪以下0.080m处设砌体防潮层，其做法为抹1:2水泥砂浆30mm厚（内掺5%防水剂），标高不同的两防潮层相邻时，应将其封闭垂直连接。防潮层以下砌体的孔洞用C20混凝土灌实，散水和勒脚抹防水砂浆20~25mm厚，勒脚高度不低于室外地坪以上500mm。
## 13.7 室内防水：
13.7.1 防水做法：卫生间、厨房、水泵房等有水房间地面和墙面防水构造做法详建施-XX构造做法表和建施-XX节点图。防水层高度为淋浴间2000mm且不低于淋浴喷淋口高度、洗手盆处1200mm、其他部位不低于完成面250mm、厨房至吊顶下。仅有洗手盆房间地面防水范围为半径1000mm半圆形范围，墙面为高度1200mm、宽度以洗手盆为中心2000mm范围。
13.7.2 上述房间门口标高均比楼层标高低15mm，楼地面找坡坡向地漏，坡度1%。防水层在门口处应水平延展，向外延展的长度不小于500mm，向两侧延展的长度不小于200mm。
13.7.3 有防水要求房间的结构板和防水层必须分别做闭水试验，验收合格后进行下一步施工。
13.7.4 凡管道穿过此类房间地面时，必须埋套管，高出地面50mm。地漏口周围、直接穿过地面或墙面防水层管道及预埋件的周围与找平层之间预留10x7mm的凹槽，并嵌密封材料。
13.7.5 有防水要求房间的墙体底部浇筑距地面完成面200mm高且宽度同墙厚的C25混凝土；管井门下设C25混凝土门槛，高100mm或同该处踢脚高；风井穿楼板时周边做C25混凝土槛100mm高，宽度同井壁厚。
13.7.6 无地下室的地面做防潮处理，其做法为垫层以上抹20mm厚防水砂浆，并与墙身防潮层连续封闭。详见墙体工程中XXX条要求。卫生间、厨房等经常用水房间顶棚应做防潮处理，其做法为为混凝土板下抹8mm厚聚合物水泥防水砂浆。
## 13.8 水池（室内水池也可按通用规范和使用场景选择二级防水设防，本样例为一级防水）
13.8.1 室内消防水池采用250mm厚（厚度以设计为准，应大于250mm厚）现浇自防水钢筋混凝土，抗渗等级为P8，水池内壁采用7厚聚合物水泥防水砂浆+1厚1.5kg/m2用量水泥基渗透结晶型防水涂料（涂刷2遍）+自防水混凝土，构造做法详见建施-XX构造做法表和建施-XX节点图。
13.8.2 室内游泳池（水池）采用250mm厚（厚度以设计为准，应大于250mm厚）现浇自防水钢筋混凝土，抗渗等级为P8，水池内壁采用7厚聚合物水泥防水砂浆+1厚1.5kg/m2用量水泥基渗透结晶型防水涂料（涂刷2遍）+自防水混凝土+2厚聚合物水泥防水涂料（Ⅱ型）（泳池也可选用防水涂膜/防水卷材+混凝土衬砌的做法）（对蓄水水质有卫生要求的混凝土结构蓄水类工程，应增加外壁防水层，至少一道防水卷材、防水涂料或水泥基防水材料防水层）。
## 13.9 防水材料性能应满足下列标准要求：
（根据工程选用的防水材料选择下列适用标准）
a.《预铺防水卷材》GB/T 23457-2017
b.《自粘聚合物改性沥青防水卷材》GB 23441-2009
c.《非固化橡化沥青防水涂料》JC/T 2428-2017
d.《水泥基渗透结晶型防水材料》GB 18445-2012
e.《聚氨酯建筑密封胶》JC/T 482-2022
f.《种植屋面用耐根穿刺防水卷材》GB/T 35468-2017
g.《弹性体改性沥青防水卷材》GB 18242-2008
h.《湿铺防水卷材》GB/T 35467-2017
i.《聚氯乙烯（PVC）防水卷材》GB 12952-2011
j.《热塑性聚烯烃（TPO）防水卷材》GB 27789-2011
k.《聚氨酯防水涂料》GB/T 19250-2013
l.《聚合物水泥防水涂料》GB/T 23445-2009
m.《热熔橡胶沥青防水涂料》JC/T 2678-2022
n.《预拌混凝土》GB/T 14902-2012`

const chapter14 = `# 14.安全防护设计：
## 14.1设计依据：
a.《民用建筑通用规范》GB 55031-2022
b.《建筑防护栏杆技术标准》JGJ/T 470-2019
c.《建筑玻璃应用技术规程》JGJ 113-2015
d.《中小学校设计规范》GB 50099-2011
e.《托儿所、幼儿园建筑设计规范》JGJ 39-2016（2019年版）
f.《建筑结构荷载规范》GB 50009-2012
g.《建筑防火通用规范》GB 55037-2022
......
## 14.2 防坠落：
14.2.1高差超过700mm的室内外地坪，应在临空面采取防护措施。
14.2.2人工水体岸边近2.0m范围内的水深大于0.50m时，应采取安全防护措施。
14.2.3本工程临空窗的窗台距楼地面的净高低于0.80m时应设置防护设施，防护高度由楼地面（或可踏面）起计算不应小于0.80m（幼儿园、老年人照料设施、宿舍为0.90m）。
14.2.4 阳台、外廊、室内回廊、中庭、自动扶梯和楼梯、上人屋面等处的临空部位设置防护栏杆(栏板)，并符合下列规定:
a.栏杆（栏板）材料坚固、耐久，安装牢固，应能承受《建筑结构荷载规范》GB 50009-2012规定的水平荷载。
b.栏杆（栏板）垂直高度不应小于1.10m。（高层建筑室外栏杆高度1.20m，上人屋面和交通、商业、旅馆、医院、学校、学校宿舍等建筑临开敞中庭等临空处栏杆高度1.20m，幼儿园1.30m）
c.当防护栏板为玻璃栏板时，应符合《建筑玻璃应用技术规程》JGJ 113-2015的相关规定，应采用夹层安全玻璃，公称厚度不小于12mm。
d.少年儿童专用活动场所的栏杆应采取防止攀滑措施，当采用垂直杆件做栏杆时，其杆件（或花饰镂空处）净间距不应大于0.11m（托儿所、幼儿园建筑杆件净间距不大于0.09m）。
14.2.5 室内楼梯扶手高度为0.90m；当水平栏杆（栏板）长度大于0.50m，扶手高度为1.05m（建议设计加大高度）；室外楼梯扶手高度为1.10m。
14.2.6 当少年儿童专用活动场所的公共楼梯井净宽大于0.20m时,应设置防坠网等防止少年儿童坠落的措施。
## 14.3 防坠物：
14.3.1 外倾斜、水平倒挂的石材或脆性材质面板设置防坠落措施。
14.3.2 建筑外窗、玻璃幕墙的可开启扇，设置防坠落措施。
14.3.3 建筑物上设置的太阳能热水或光伏发电系统、暖通空调设备、广告牌、外遮阳设施、装饰线脚等附属构件或设施应满足建筑结构及其他相应的安全性要求，并应采取防止构件或设施坠落的安全防护措施。
14.3.4吊顶与主体结构的吊挂应采取安全构造措施。重量大于3kg的物体，以及有振动的设备应直接吊挂在建筑承重结构上。
14.3.5 公共场所临空且下部有人员活动部位的栏杆（栏板），在地面以上0.10m高范围内不留空，设置实体栏板或反坎。
## 14.4防冲撞：
14.4.1人员能到达的公共空间，采用落地玻璃窗时，需要采用安全玻璃。并应设置防撞提示。
14.4.2 本工程安全玻璃使用部位：面积大于1.5m2的窗玻璃或玻璃底边距装修面小于500mm的落地窗、玻璃幕墙、观光电梯及其外围护玻璃墙、室内玻璃隔断、楼梯、平台走廊和中庭的玻璃栏板、玻璃雨篷、玻璃地面板、公共建筑出入口门厅部位，易遭受冲撞、冲击而造成人体伤害的其他部位。并应设置防撞提示。
14.4.3 安装在易于受人体或物体碰撞部位的建筑玻璃（如落地窗、玻璃门、玻璃隔断等）应采取保护措施。易发生碰撞的玻璃隔断、玻璃门处，在视线高度设置醒目标志。落地幕墙和外窗（包括低窗台外窗）设置防碰撞栏杆。
14.4.4 自动扶梯交叉位置以及与周边墙体、楼板开洞边缘安全防护距离小于500时，应在产生的锐角口前部1.00m处范围设置具有防夹、防剪的保护设施或采取其他防止建筑障碍物伤害人员的措施；
14.4.5 建筑内部车行空间与建筑部件的阳角部位应设置防撞护角；
## 14.5 防滑：
14.5.1本项目的建筑地面分为整体地面和块材地面，每种地面分为干态和湿态两种使用环境,用于坡地、台阶、楼梯、运动场所及长期有水地面的地砖并在表面增加防滑措施，凡图中注明的防滑地砖，均属于此种；
14.5.2室内防滑地面表面经处理后地面整体防滑等级不低于《建筑地面工程防滑技术规程》JGJ/T 331-2014规定的Ad、AW级、即湿态地面防滑值（BPN）≥80，干态地面静摩擦系数（COF)≥0.7；
14.5.3 用于室内其他地面整体防滑等级不低于《建筑地面工程防滑技术规程》JGJ/T 331-2014规定的Bd、BW级,即湿态地面防滑值（BPN）≥60，干态地面静摩擦系数（COF)≥0.6。
14.5.4 室外活动场所（包括人行道、步行街、广场、停车场等）采用防滑地面，防滑等级不低于《建筑地面工程防滑技术规程》JGJ/T 331-2014 规定的Bw级。
14.5.5 坡道、楼梯踏步防滑等级不低于《建筑地面工程防滑技术规程》JGJ/T 331-2014规定的Ad、Aw级或按水平地面等级提高一级，并采用防滑条等防滑构造技术措施。
## 14.6 室内环境污染控制：
14.6.1本工程建筑材料及装修材料放射性限量及污染物控制应满足《建筑环境通用规范》GB 55016-2021、《民用建筑工程室内环境污染控制标准》GB 50325-2020相关要求。
14.6.2 建筑材料及装修材料应进场检验，不符合设计要求及相关规范规定时严禁使用。
## 14.7其他
14.7.1 地下室高窗、窗井、通风竖井等处须有可靠的安全防护措施和防盗装置，通风孔洞处应加设防鼠、防虫不锈钢保护网，筛孔尺寸为1.0mmx1.0mm。
14.7.2 消防控制室门口应设置高度不低于400mm的挡鼠板；食品库房门口应设置高度不低于600mm的挡鼠板。
14.7.3 处于腐蚀环境的建筑物应提高结构自身耐久性并附加防护措施；室外吊顶应抗风揭，面板及支撑结构应防腐蚀。`

const chapter15 = `# 15.隔声、降噪、减震设计：
## 15.1设计依据：
a.《建筑环境通用规范》GB 55016-2021
b.《民用建筑通用规范》GB 55031-2022
c.《民用建筑隔声设计规范》GB 50118-2010
d.《建筑门窗空气声隔声性能分级及检测方法》GB/T 8485-2008
e.《工程隔振设计标准》GB50463-2019
......
## 15.2 隔声：
15.2.1 外墙的空气声隔声性能满足Rw+Ctr≥30dB，外门窗的空气声隔声性能满足Rw+Ctr≥30dB，内门的空气声隔声性能满足Rw+C≥20dB（本数据仅为示例，隔声性能按照建筑性质查找《民用建筑隔声设计规范》GB50118-2010相关章节确定）。
15.2.2 所有XXX室的内隔墙、楼板均满足空气声隔声性能Rw+C>45 dB，且满足空气声隔声性能DnT，W+C≥45dB。
15.2.3 如下房间采用隔声门，其隔声性能满足Rw+Ctr≥25dB，空调机房、低压配电室、水泵房、制冷机房等。
15.2.4 管线穿过有隔声要求的墙或楼板时应先预埋套管，套管内径比管道外径大50mm，采用隔声材料填缝密封；大断面的风管穿过墙体和楼板时，应在留洞位置设置套框，待风管安装后填缝堵严。套管穿墙构造参照《建筑隔声与吸声构造》08J931第37页做法。
## 15.3 降噪：
空调机房等开向公共空间的噪声源房间均采用吸声墙面和吊顶，详见建施-XX《室内外装修做法表》。
## 15.4 减震：
设有基础的水泵、冷却塔、风冷机组、风机、变压器、电梯曳引机等在安装时应在基础与设备支座之间增设减震垫等措施。`

const chapter16 = `# 16.标识设计：
## 16.1设计依据：
a.《民用建筑通用规范》GB55031-2022
b.《公共建筑标识系统技术规范》GB/T51223-2017
c.《安全标志及其使用导则》GB2894-2008
d.《消防安全标志》GB13495-2015
e.《无障碍设计规范》GB 50763-2012
......
## 16.2 安全防护警示和引导标识系统：
16.2.1 建筑内外均应设置便于识别和使用的标识系统，包括具有警示和引导功能的安全标识。
16.2.2 公共建筑群在场地出入口设置总平面布置图，标注楼号及建筑出入口等信息；建筑物主要入口处设置附着式门牌号标识及单位名称标识。
16.2.3 首层出入口门厅或交通厅处，设置框架式或附着式各楼层功能房间信息索引标识。
16.2.4 每层公共服务用房和设施（包含但不限于卫生间、楼梯间、电梯厅、自动扶梯、无障碍设施）均应设置引导标识及位置标识。
16.2.5 标识应醒目、易辨识并放置于显著位置上，符合《安全标志及其使用导则》GB2894-2008相关要求。
## 16.3 消防救援和安全疏散的警示和引导标识系统：
16.3.1 在建筑周围的消防车道和消防车登高操作场地，设置明显的消防车道或消防车登高操作场地的标识和不得占用、阻塞的警示标志。
16.3.2 在各层醒目位置设置楼层疏散平面图，提供方位信息、指示疏散路线。16.3.3 在消防救援口设置可在室内和室外识别的永久性明显标志。
16.3.4 在消火栓、消防水泵接合器两侧沿道路方向各5m范围内，应在明显位置设置警示标志。
16.3.5 在下列位置附近的显著位置应设置明显标识：消防电梯首层入口处、火灾时用于辅助人员疏散的电梯附近、疏散通道、疏散走道、疏散出口门内一侧、疏散楼梯间的各层入口处。
## 16.4 无障碍标识：
16.4.1 无障碍标识纳入室内外环境标识系统，应连续并清楚地指明无障碍设施的位置和方向。
16.4.2 无障碍卫生间、无障碍机动车位、无障碍电梯等无障碍设施处均设置无障碍标识。
## 16.5 室内停车场的车行导向标识系统另见专项设计。
（16.6 对于轨道交通建筑、机场、医院、博览建筑、大型商业综合体等复杂工程，室内外空间标识系统另行委托专项设计。）`

const chapter17 = `# 17.构件防腐及油漆粉刷工程：
## 17.1 所有埋入墙体的木构件需涂水溶性防腐剂，露明部分刷底漆一道，调和漆二道；室外木构件采用丙烯酸底漆2道后再做面漆。
## 17.2 所有金属构件均刷防腐漆二道，露明部分再刷调和漆二道。
## 17.3 除特殊注明外,轻钢雨篷、室外金属制品露明部分除锈后均刷专用防锈漆,氟碳金属底漆一道,深灰色氟碳金属面漆二道。
## 17.4所有喷涂、油漆、粉刷均需先做样板，经设计方和建设方确认后封样，并据此进行验收。`

const chapter18 = `# 18.安全管理：
## 18.1 本工程施工必须严格执行中华人民共和国住房和城乡建设部令第37号《危险性较大的分部分项工程安全管理规定》。
## 18.2 本工程涉及危险性较大的分部分项工程的重点部位和环节如下：
18.2.1幕墙安装工程：
a.为保障工程周边环境安全和工程施工安全，必须严格按照《建筑幕墙》GB/T21086-2007、《玻璃幕墙工程技术规范》JGJ102-2003、《金属与石材幕墙工程技术规范》JGJ133-2001的要求设计、施工。
b.对于施工高度50米及以上的建筑幕墙安装工程，施工单位必须会同建设单位组织召开专家论证会，论证专项施工方案。
18.2.2 可能影响行人、交通、电力设施、通讯设施或其它建、构筑物安全的拆除工程，施工单位应制定专项施工方案。 (如本工程不涉及此条内容，可删除此条)
18.2.3 采用XX新技术、新工艺、新材料、新设备及尚无相关技术标准的危险性较大的分部分项工程。施工单位应制定专项施工方案。 (如本工程不涉及此条内容，可删除此条)
18.2.4装配式建筑混凝土预制构件安装工程，施工单位应制定专项施工方案。(如本工程不涉及此条内容，可删除此条)
（注：如在本工程中尚有其它涉及危大工程的重点部位和环节的内容，应给出保障工程周边环境安全和工程施工安全的意见和说明，按照《危险性较大的分部分项工程安全管理规定》相关要求）`

const chapter19 = `# 19.工种配合和施工要点：
## 19.1 施工中所有地沟、地坑、预留洞及管线安装、镶入构件等均需参照相关专业图纸核对无误后方可施工，不得事后打洞。施工中需密切配合各专业图纸，如各专业图纸不一致时应及时与设计单位联系，待设计协调解决后施工。
## 19.2 施工单位在管线安装前应先做好管线综合施工方案。
## 19.3 所有加气混凝土制品均采用蒸压砂加气混凝土制品，保证材料的耐久性。
## 19.4 土建预留孔洞、预埋件等施工时应与机电、工艺等有关图纸密切配合施工。本施工图仅表示主要预留孔洞和预埋件。
## 19.5 所有与设备安装相关的土建施工均需待设备确定后，根据建设单位提供的设备资料核对无误后，经专业设备安装人员指导后施工。
## 19.6 厨房操作间需由专业厨具公司根据建设单位要求进行深化设计。
## 19.7 幕墙部分由专业幕墙公司根据本施工图进行深化设计。
## 19.8 室内精装修由专业装修公司根据设计单位和建设单位要求进行深化设计。精装修设计不应降低建筑消防及耐火等级，并不应突破建筑设计荷载。装修设计需满足《建筑内部装修设计防火规范》GB 50222-2017及其他现行相关标准的要求。
## 19.9 施工时必须严格遵守国家现行有关设计和施工验收规范和标准的规定，本说明未尽事宜应按照国家现行有关设计和施工验收规范和标准执行。
## 19.10 本图纸以所标注尺寸为准，不可在图上量取。
## 19.11 本工程图纸必须按照国家及地方规定提交相关机构审查，审查合格且加盖合格印章后方可用于施工。
## 19.12 所有由其它专业公司进行的专项设计必须以本施工图及配套计算书为依据，并满足使用功能、安全、消防、节能等要求，同时不得影响结构安全和机电设施正常工作。`

const chapter20 = `# 20.人防设计：
本工程地下二层设人防工程，为战时核6级常6级甲类二等人员掩蔽所，防化等级为丙级，为平时为汽车库，人防设计说明详见人防图纸。`

const chapter21 = `# 21.节能设计：
## 21.1设计依据：
a.《建筑节能与可再生能源利用通用规范》GB55015-2021
b.《民用建筑热工设计规范》GB50176-2016
c.《公共建筑节能设计标准》GB50189-2015
d.《建筑外门窗气密、水密、抗风压性能检测方法》 GB/T7106-2019
e.《建筑幕墙、门窗通用技术条件》GB/T31433-2015
f.《岩棉薄抹灰外墙外保温工程技术标准》JGJ/T 480-2019
其他国家及地方现行标准
## 21.2 工程概况：

| 建设地点 | 辽宁省沈阳市 | 辽宁省沈阳市 | 建筑性质 | 公建 办公 |
| --- | --- | --- | --- | --- |
| 气候分区 | 严寒（C）区 | 严寒（C）区 | 高度（m） | 80 |
| 总建筑面积（m2） | 地上面积 | 20000 | 结构形式 | 框架 |
| 23000 | 地下面积 | 3000 | 计算方法 | 采用权衡判断法 |
| 建筑类别 | 甲类 | 甲类 | 设计使用软件 | 斯维尔节能设计软件 |
| 建筑层数（层） | 地上层数 | 24 | 建筑外表面积（m2） |  |
| 建筑层数（层） | 地下层数 | 2 | 建筑体积（m3） |  |

## 21.3 窗墙面积比、体形系数与限值的对比：

| 窗墙面积比 | 窗墙面积比 | 窗墙面积比 | 窗墙面积比 | 窗墙面积比 | 屋面透明部分面积之比 | 体形系数 |
| --- | --- | --- | --- | --- | --- | --- |
| 平均 | 东 | 南 | 西 | 北 | 0.0<0.2 | 0.12<0.4 |
|  | 0.0<0.7 | 0.0<0.7 | 0.0<0.7 | 0.0<0.7 | 0.0<0.2 | 0.12<0.4 |

## 21.4 围护结构传热系数（w/（m2.k））与限值的对比：

| 屋面 | 外墙平均 | 底面接触室外空气的架空或外挑楼板 | 非供暖楼梯间与供暖房间的隔墙 | 地下车库与供暖房间的楼板 | 变形缝（两侧墙内保温时）R （m2.k/w） | 供暖地下室与土壤接触的地下室外墙R （m2.k/w） |
| --- | --- | --- | --- | --- | --- | --- |
| 0.00<0.30 | 0.00<0.38 | 0.00<0.38 | 0.00<1.00 | 0.00<0.70 | 0.00≥1.20 | 0.00≥1.50 |
| 天窗 | 南窗 | 北窗 | 东窗 | 西窗 | 周边地面R （m2.k/w） |  |
| 0.00<2.30 | 0.00<1.8 | 0.00<1.8 | 0.00<1.8 | 0.00<1.8 | 0.00≥1.10 |  |

## 21.5 节能措施及保温材料：
21.5.1 外墙：本工程外墙为混凝土小型空心砌块，外贴100mm厚岩棉板保温。
21.5.2 屋面：屋面为现浇钢筋混凝土板，上铺110mm厚挤塑聚苯乙烯泡沫板（XPS）保温。
21.5.3 挑空楼板：板下外贴100mm厚岩棉板保温。
21.5.4 采暖与非采暖房间楼板：板底40mm厚无机纤维喷涂（70mm厚岩棉板龙骨体系）；采暖与非采暖房间隔墙采用200mm厚蒸压砂加气砌块墙。
21.5.5 地下室外墙贴80mm厚挤塑聚苯乙烯泡沫板（XPS）保温层兼做保护层。
21.5.6 变形缝内填充的保温材料应沿高度和顶边水平方向填满，且缝边水平、垂直方向填充深度均不应小于1000mm,且填充材料应与变形缝两侧墙体有效结合。
## 21.6 保温材料物理性能：

| 名称 | 导热系数 （w/（m.k）） | 密度 （kg/m3） | 抗拉强度 （MPa） | 压缩强度 （KPa） | 吸水率 （%） | 燃烧性能等级 |
| --- | --- | --- | --- | --- | --- | --- |
| 岩棉板 | 0.040 | 140 | ≥0.010 （TR10） | ≥40 | 质量吸湿率≤1 | A |
| 挤塑聚苯乙烯泡沫板（XPS） | 0.030 | 30 | ≥0.20 | ≥200 | ≤1.5 | B1 |
| 模塑聚苯乙烯泡沫板（EPS） | 0.039 | 20 | ≥0.10 | ≥100 | ≤3 | B1 |
| ...... |  |  |  |  |  |  |

## 21.7 外门窗性能：
21.7.1 透明外门与外窗采用单框三玻塑钢窗，玻璃采用6+12A+6透明+12A+6透明中空玻璃，传热系数为2.0w/（m2.k）；幕墙采用玻璃为10mm钢化+12A+8mm钢化LOW-E中空玻璃，传热系数2.2w/（m2.k）。
21.7.2 幕墙、外窗(包括封闭阳台外窗)、敞开式阳台的阳台门(窗)应具有良好的密闭性能，其气密性等级不应低于国家标准《建筑幕墙、门窗通用技术条件》GB/T31433-2015 中相关要求，门窗气密性为6级，幕墙气密性为3级。
## 21.8 保温构造：
21.8.1 门、窗框等位置均采用发泡聚氨酯填充，靠室内外侧与饰面交界处设置绝热嵌缝条，并用耐候密封胶封严。
21.8.2 对伸出外墙的雨水管卡、预埋件、支架和其它设备穿墙孔洞缝隙安装到位后，必须采用中性耐候胶防水密封胶填实，以防雨水渗漏。
## 21.9 结论：
本工程经外围护结构热工性能权衡判断计算，判定设计建筑符合节能设计标准。`

const chapter22 = `# 22.碳排放计算和可再生能源利用：
## 22.1 设计依据
a.《建筑碳排放计算标准》GB/T 51366-2019
b.《建筑节能与可再生能源利用通用规范》GB 55015-2021
c.《公共建筑节能设计标准》GB 50189-2015
d.《民用建筑热工设计规范》GB 50176-2016
e.《外墙外保温工程技术标准》JGJ 144-2019
f.《建筑外门窗气密、水密、抗风压性能检测方法》GB/T 7106-2019
## 22.2 维护结构做法：
详见节能设计专篇
## 22.3设计建筑碳排放情况
22.3.1采暖空调系统

| 类别 | 负荷(kWh/a) | 系统综合性能系数 | 耗电量(kWh/a) | 碳排放因子 （kgCO2/kWh） | 碳排放量(tCO2/a) |
| --- | --- | --- | --- | --- | --- |
| 供冷 |  |  |  |  |  |
| 供暖 |  |  |  |  |  |
| 总计 |  |  |  |  |  |

22.3.2生活热水系统

| 热水设备 | 供热量(kWh/a) | 能源 | 效率 | 耗电量(kWh/a) | 碳排放因子 （kgCO2/kWh） | 碳排放量(tCO2/a) |
| --- | --- | --- | --- | --- | --- | --- |
| 锅炉 | 0 | 电 | 0.9 | 0 |  |  |
| 电热水器 |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
| 总计 |  |  |  |  |  |  |

22.3.3照明系统

| 房间类型 | 单位面积耗电 (kWh/m2.a) | 合计耗电 (kWh/a) | 碳排放因子 （kgCO2/kWh） | 碳排放量(tCO2/a) |
| --- | --- | --- | --- | --- |
| 会议室 |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
| 总计 |  |  |  |  |

22.3.4电梯与扶梯

| 名称 | 特定能量消耗(mWh/kgm) | 额定载重量 （kg） | 速度(m/s) | 待机功率 （w） | 运行时长 （h/天） | 年运行天数 | 数量 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 直梯1 |  |  |  |  |  |  |  |
| 直梯2 |  |  |  |  |  |  |  |
| 扶梯1 |  |  |  |  |  |  |  |
| 扶梯2 |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |


| 名称 | 电耗 (kWh/a) | 碳排放因子 (kgCO2/kWh) | 碳排放量(tCO2/a) |
| --- | --- | --- | --- |
| 直梯1 |  |  |  |
| 直梯2 |  |  |  |
| 扶梯1 |  |  |  |
| 扶梯2 |  |  |  |
|  |  |  |  |

## 22.4可再生能源系统：
22.4.1日照辐照量：XXXX (KJ/m2.天）；运行天数：365天。

| 光伏板面积 （m2） | 单位面积发电参数 （kW/m2） | 光伏系统效率 | 光伏电池性能衰减修正系数 | 全年供电 (kWh/a) | 碳排放因子(kgCO2/kWh) | 可减少碳排放 (tCO2/a) |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

（结合实际情况，如有太阳能热水系统等需补充表格）
22.4.2本项目经日照时数分析，建筑屋面南向不受出屋面机房遮挡区域具备应用太阳能系统的条件，拟布置太阳能光伏发电系统（太阳能热利用系统、太阳能光伏光热（PV/T)系统等）。
22.4.3本设计为太阳能系统提供安装位置和基础条件预留，待确定产品后由专业厂家负责二次深化设计，太阳能系统应与建筑主体同步竣工投入使用。
## 22.5建筑运行碳排放

| 电力 | 类别 | 设计建筑碳排放量(kgCO2/㎡·a) | 参照建筑碳排放量(kgCO2/㎡·a) |
| --- | --- | --- | --- |
| 供冷(Ec) | 供冷(Ec) | 8.84 | 12.20 |
| 供暖(Eh) | 供暖(Eh) | 6.95 | 0.00 |
| 照明 | 照明 | 7.82 | 7.82 |
| 其他(Eo) | 电梯 | 0.00 | 0.00 |
| 其他(Eo) | 生活热水 | 0.00(扣减了太阳能) | 0.00 |
| 其他(Eo) | 合计 | 0.00 | 0.00 |
| 化石燃料 | 所属类别 | 设计建筑碳排放量(kgCO2/㎡·a) | 参照建筑碳排放量(kgCO2/㎡·a) |
|  | 供暖系统 | 0.00 | 18.36 燃料：煤 |
| 无 | 生活热水(扣减了太阳能) | 0.00 | 1.34 |
| 燃气可再生 | 类别 | 设计建筑碳减排量(kgCO2/㎡·a) | 参照建筑碳减排量(kgCO2/㎡·a) |
| 可再生能源(Er) | 光伏(Ep) | 0.00 | - |
| 可再生能源(Er) | 风力(Ew) | 0.00 | - |
| 碳排放合计 | 碳排放合计 | 23.60 | 58.09 |
| 相对参照建筑降碳比例(%) | 相对参照建筑降碳比例(%) | 59.37 (目标值: 40) | 59.37 (目标值: 40) |
| 相对参照建筑碳排放强度降低值 (kgCO2/(m2·a) | 相对参照建筑碳排放强度降低值 (kgCO2/(m2·a) | 34.49 (目标值:7) | 34.49 (目标值:7) |

## 22.6 结论：
综合以上计算结果，本项目的建筑运行碳排放强度在2016年执行的节能设计标准的基础上降低了XX.XX%，碳排放强度降低了X.XXkgCO2/(m2.a)，建筑运行碳排放指标满足《建筑节能与可再生能源利用通用规范》GB55015-2021第2.0.3条的要求。`


const chapter23 = `# 23.绿色建筑设计：
（绿色建筑章节内容和格式应按照各地区绿建相关要求描述，本样例暂适合沈阳地区）
## 23.1 项目概况：

| 建设地点 | 辽宁省沈阳市XX区 | 辽宁省沈阳市XX区 | 辽宁省沈阳市XX区 | 建筑性质 | 公共建筑： 办公建筑 | 公共建筑： 办公建筑 |
| --- | --- | --- | --- | --- | --- | --- |
| 气候分区 | 严寒（C）区 | 严寒（C）区 | 严寒（C）区 | 容积率 | 5.4 | 5.4 |
| 总建筑面积（m2） | 10000 | 地上建筑面积（m2） | 地上建筑面积（m2） | 5000 | 地下建筑面积（m2） | 5000 |
| 建筑类别 | 甲类 | 甲类 | 甲类 | 高度（m） | 100 | 100 |
| 建筑层数（层） | 地上层数 | 地上层数 | 24 | 结构形式 | 框架结构 | 框架结构 |
| 建筑层数（层） | 地下层数 | 地下层数 | 2 | 绿地率 | 30% | 30% |
| 绿色建筑设计目标 | 本项目符合《绿色建筑评价标准》GB/T 50378-2019（2024年版）基本级及《沈阳市绿色建筑设计施工图审查技术要点》（2020年版）的相关要求 | 本项目符合《绿色建筑评价标准》GB/T 50378-2019（2024年版）基本级及《沈阳市绿色建筑设计施工图审查技术要点》（2020年版）的相关要求 | 本项目符合《绿色建筑评价标准》GB/T 50378-2019（2024年版）基本级及《沈阳市绿色建筑设计施工图审查技术要点》（2020年版）的相关要求 | 本项目符合《绿色建筑评价标准》GB/T 50378-2019（2024年版）基本级及《沈阳市绿色建筑设计施工图审查技术要点》（2020年版）的相关要求 | 本项目符合《绿色建筑评价标准》GB/T 50378-2019（2024年版）基本级及《沈阳市绿色建筑设计施工图审查技术要点》（2020年版）的相关要求 | 本项目符合《绿色建筑评价标准》GB/T 50378-2019（2024年版）基本级及《沈阳市绿色建筑设计施工图审查技术要点》（2020年版）的相关要求 |

## 23.2 设计依据：
a.《绿色建筑评价标准》GB/T 50378-2019（2024年版）
b.《公共建筑节能设计标准》GB50189-2015
c.《民用建筑绿色设计规范》JGJ/T229-2010
d.《民用建筑隔声设计规范》GB20118-2010
e.《民用建筑热工设计规范》GB50176-2016
f.《建筑采光设计标准》GB50333-2013
g.《建筑外门窗气密、水密、抗风压性能检测方法》GB/T7106-2019
h.《建筑幕墙、门窗通用技术条件》GB/T31433-2015
i.其他国家及地方现行标准
j.当地建设、规划主管部门对本项目的批文
## 23.3 评定表格：
（以下为沈阳市施工图审查相关要求，其他地区项目应符合当地有关绿建专篇的要求）
沈阳市绿色建筑施工图审查要点评定表（建筑和其他项）

| 条文 | 自评达 标情况 | 自评材料 | 审查评 定意见 | 备注 |
| --- | --- | --- | --- | --- |
| 条文 | □满足 | 自评材料 | □满足/ □不满足 | 备注 |
| 3.1 建筑专业 |  |  |  |  |
| 3.1.1 建筑结构应满足承载力和建筑使用功能要求。建筑外墙、屋面、门窗、幕墙及外保温等围护结构应满足安全、耐久和防护的要求。 | □满足 | 建筑外墙、屋面、门窗、幕墙、外保温等围护结构和外装饰构件与建筑主体结构连接可靠，且能适应主体结构在多遇地震及各种荷载作用下的变形，满足安全、耐久、防护要求：□是、□否 建筑外墙、屋面、门窗、幕墙及外保温等围护结构和建筑外侧设置装饰构件的防水、防渗等设计要求:□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.2 外遮阳、太阳能设施、空调室外机位、外墙花池等外部设施应与建筑主体结构统一设计、施工，并应具备安装、检修与维护条件。 | □满足 | 建筑外部是否有以下设施： 检修通道、□马道、□吊篮固定端、预埋件、外遮阳、太阳能设施、空调室外机位、外墙花池、□以上皆无 如有以上设施，与建筑主体结构统一设计、施工，并应具备安装、检修与维护条件：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.3 建筑外门窗必须安装牢固，其抗风压性能和水密性能应符合国家现行有关标准的规定。 | □满足 | 外门窗的抗风压性能、水密性能指标和等级，并应符合《塑料门窗工程技术规程》 JGJ 103 、《铝合金门窗工程技术规范》 JGJ 214、《建筑外门窗气密、水密、抗风压性能分级及检测方法》GB/T 7106 等现行相关标准的规定：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.4 卫生间、浴室的地面应设置防水层，墙面、顶棚应设置防潮层。 | □满足 | 卫生间、浴室防水防潮措施： □楼地面低于相邻楼地面15.0mm、□采取防水、防滑的构造措施（如采用不吸水、易冲洗、防滑的面层材料）、□设排水坡坡向地漏、□设门槛等挡水设施、□设排水设施、□设防水隔离层、□以上皆无 | □满足/□不满足 | 建筑 |
| 3.1.5 走廊、疏散通道等通行空间应满足紧急疏散、应急救护等要求，且应保持畅通。 | □满足 | 1建筑应根据其高度、规模、使用功能和耐火等级等因素合理设置安全疏散和避难设施：□是、□否 2 安全出口和疏散门的位置、数量、宽度及疏散楼梯间的形式，应满足人员安全疏散的要求：□是、□否 3 走廊、疏散通道等应满足现行国家标准《建筑设计防火规范》 GB 50016 、《防灾避难场所设计规范》 GB 51143 等对安全疏散和避难、应急交通的相关要求：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.6 采用具有安全防护功能的产品或配件，采用具备防夹功能的门窗。 | □满足 | 人流量大、门窗开合频繁的位置，应采用可调力度的闭门器或具有缓冲功能的延时闭门器等措施：是、□否 | □满足/□不满足 | 建筑 |
| 3.1.7 安全耐久相关技术要求应符合现行强制性工程建设规范《建筑环境通用规范》GB55016、《民用建筑通用规范》GB55031、《建筑防火通用规范》GB55037等的规定。 | □满足 | 安全耐久相关技术要求是否符合上述现行强制性工程建设规范等的规定：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.8 室内外地面或路面设置防滑措施： 1 建筑出入口及平台、公共走廊、电梯门厅、厨房、浴室、卫生间等设置防滑措施，防滑等级不低于现行行业标准《建筑地面工程防滑技术规程》 JGJ/T 331 规定的 Bd、Bw 级； 2 建筑室内外活动场所采用防滑地面，防滑等级达到现行行业标准《建筑地面工程防滑技术规程》 JGJ/T 331 规定的Ad 、Aw级； 3 建筑坡道、楼梯踏步防滑等级达到现行行业标准《建筑地面工程防滑技术规程》 JGJ/T 331 规定的 Ad、Aw 级或按水平地面等级提高一级，并采用防滑条等防滑构造技术措施。 | □满足 | 1 建筑出入口及平台、公共走廊、电梯门厅、厨房、浴室、卫生间等设置防滑措施，防滑等级不低于现行行业标准《建筑地面工程防滑技术规程》 JGJ/T 331 规定的 Bd、Bw 级：□是、□否 2 建筑室内外活动场所采用防滑地面，防滑等级达到现行行业标准《建筑地面工程防滑技术规程》 JGJ/T 331 规定的Ad 、Aw级：□是、□否 3 建筑坡道、楼梯踏步防滑等级达到现行行业标准《建筑地面工程防滑技术规程》 JGJ/T 331 规定的 Ad、Aw 级或按水平地面等级提高一级，并采用防滑条等防滑构造技术措施：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.9 合理采用耐久性好、易维护的装饰装修建筑材料。 1 采用耐久性好的外饰面材料； 2 采用耐久性好的防水和密封材料； 3 采用耐久性好、易维护的室内装饰装修材料。 | □满足 | 1 采用耐久性好的外饰面材料：□是、□否 2采用耐久性好的防水和密封材料：□是、□否 3采用耐久性好、易维护的室内装饰装修材料：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.10 建筑声环境设计应满足相关规定。 | □满足 | 1建筑平面设计时应合理规划噪声源区域和噪声敏感区域，并应进行识别和标注：□是、□否 2外墙、隔墙、楼板和门窗等主要建筑构件的隔声性能指标不应低于现行国家标准《民用建筑隔声设计规范》GB50118的规定，并应根据隔声性能指标明确主要建筑构件的构造做法：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.11 围护结构热工性能应符合下列规定： 1 在室内设计温度、湿度条件下，建筑非透光围护结构内表面不得结露； 2 供暖建筑的屋面、外墙内部不应产生冷凝； 3 屋顶和外墙应进行隔热性能计算，透光围护结构太阳得热系数与夏季建筑遮阳系数的乘积还应满足现行国家标准《民用建筑热工设计规范》 GB 50176 的要求。 | □满足 | 1 在室内设计温度、湿度条件下，建筑非透光围护结构内表面不得结露，□是、□否 2 供暖建筑的外墙、屋面应根据现行国家标准《民用建筑热工设计规范》 GB 50176 的要求，进行内部冷凝验算，不产生冷凝，□是、□否 3 屋顶和外墙隔热性能经计算应满足现行国家标准《民用建筑热工设计规范》 GB 50176 的要求，□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.12 停车场应具有电动汽车充电设施或具备充电设施的安装条件，并应合理设置电动汽车和无障碍汽车停车位。 | □满足 | 是否具有电动汽车充电设施或具备充电设施的安装条件：□是、□否 合理设置电动汽车和无障碍汽车停车位：□是、□否 对于居住区，居住区停车场和车库的总停车位应设置不少于0. 5%的无障碍机动车停车位，若设有多个停车场和车库，宜每处设置不少于1个无障碍机动车停车位：□是、□否 对于公共建筑，建筑基地内总停车数在 100 辆以下时应设置不少于1个无障碍机动车停车位， 100 辆以上时应设置不少于总停车数 1% 的无障碍机动车停车位：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.13 自行车停车场所应位置合理、方便出入。 | □满足 | 设置自行车停车场所：是、□否 设置自行车停车场所位置合理、方便出入：是、□否 | □满足/□不满足 | 建筑 |
| 3.1.14 生活便利相关技术要求应符合现行强制性工程建设规范《建筑与市政工程无障碍通用规范》GB55019、《建筑节能与可再生能源利用通用规范》GB 55015等的规定。 | □满足 | 生活便利相关技术要求是否符合上述现行强制性工程建设规范的规定：是、□否 | □满足/□不满足 | 建筑 |
| 3.1.15 建筑室内外公共区域满足全龄化设计要求，建筑室内公共区域、室外公共活动场地及道路均满足无障碍设计要求。 | □满足 | 建筑室内公共区域、室外公共活动场地及道路均满足无障碍设计要求。□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.16 应结合场地自然条件和建筑功能需求，对建筑的体形、平面布局、空间尺度、围护结构等进行节能设计，且应符合国家有关节能设计的要求。 | □满足 | 优化体形、空间平面布局，包括合理控制建筑空调供暖的规模、区域和时间，可以实现对建筑的自然通风和天然采光的优先利用，降低供暖空调照明负荷，降低建筑能耗，□是、□否 满足相关节能设计标准，□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.17 垂直电梯应采取群控、变频调速或能量反馈等节能措施；自动扶梯应采用变频感应启动等节能控制措施。 | □满足 | 是否设有电梯：是、□否 是否采取群控、变频调速或能量反馈等节能措施：是、□否 是否设有自动扶梯：是、□否 自动扶梯应采用变频感应启动等节能控制措施：是、□否 | □满足/□不满足 | 建筑 |
| 3.1.18 建筑造型要素应简约，应无大量装饰性构件，并应符合下列规定： 1 住宅建筑的装饰性构件造价占建筑总造价的比例不应大于2%; 2 公共建筑的装饰性构件造价占建筑总造价的比例不应大于1%。 | □满足 | 本项目是否使用了装饰性构件：□是、□否； 如果使用了具备功能的装饰性构件，住宅建筑的装饰性构件造价占建筑总造价的比例不应大于2%：□是、□否 如果使用了具备功能的装饰性构件，公共建筑的装饰性构件造价占建筑总造价的比例不应大于1%：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.19 资源节约相关技术要求应符合现行强制性工程建设规范《建筑节能与可再生能源利用通用规范》GB 55015等的规定。 | □满足 | 资源节约相关技术要求是否符合上述现行强制性工程建设规范的规定：是、□否 | □满足/□不满足 | 建筑 |
| 3.1.20 场地内不应有排放超标的污染源。 | □满足 | 场地内是否有以下建筑或设施： □餐饮类建筑、□锅炉房、□垃圾运转站、 □其他易产生烟、气、尘、噪声的建筑或设施（_____________）、□以上皆无 如有以上建筑或设施，有污染源应积极采取相应的治理措施并达到无超标污染物排放的要求：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.21 不得采用国家和地方禁止和限制使用的建筑材料及制品，鼓励采用国家及地方推荐的绿色建材。 | □满足 | 不得采用国家和地方禁止和限制使用的建筑材料及制品：□是、□否 采用国家及地方推荐的绿色建材：□是、□否 | □满足/□不满足 | 建筑 |
| 3.1.22 环境宜居相关技术要求应符合现行强制性工程建设规范《建筑环境通用规范》GB 55016-2021、《市容环卫工程项目规范》GB 55013-2021、《园林绿化工程项目规范》GB 55014-2021等的规定。 | □满足 | 环境宜居相关技术要求是否符合上述现行强制性工程建设规范的规定：是、□否 | □满足/□不满足 | 建筑 |
| 3.6 其它 |  |  |  |  |
| 3.6.1场地应避开滑坡、泥石流等地质危险地段，易发生洪涝地区应有可靠的防洪涝基础设施；场地应无危险化学品、易燃易爆危险源的威胁，应无电磁辐射、含氡土壤的危害。 | □满足 | □是、□否 | □满足/□不满足 |  |
| 3.6.2 应具有安全防护的警示和引导标识系统。 | □满足 | □是、□否 | □满足/□不满足 |  |
| 3.6.3 室内空气中的氨、甲醛、苯、总挥发性有机物、氡等污染物浓度应符合现行国家标准《室内空气质量标准》 GB/T18883 的有关规定。建筑室内和建筑主出入口处应禁止吸烟，并应在醒目位置设置禁烟标志。 | □满足 | □是、□否 | □满足/□不满足 |  |
| 3.6.4 建筑、室外场地、公共绿地、城市道路相互之间应设置连贯的无障碍步行系统。 | □满足 | □是、□否 | □满足/□不满足 |  |
| 3.6.5 场地人行出入口 500m内应设有公共交通站点或配备联系公共交通站点的专用接驳车。 | □满足 | □是、□否 | □满足/□不满足 |  |
| 3.6.6 建筑规划布局应满足日照标准，且不得降低周边建筑的日照标准。 | □满足 | □是、□否 | □满足/□不满足 |  |
| 3.6.7 室外热环境应满足国家现行有关标准的要求。 | □满足 | □是、□否 | □满足/□不满足 |  |
| 3.6.8 配建的绿地应符合所在地城乡规划的要求，应合理选择绿化方式，植物种植应适应当地气候和土壤，且应无毒害、易维护，种植区域覆土深度和排水能力应满足植物生长需求，并应采用复层绿化方式。 | □满足 | □是、□否 | □满足/□不满足 |  |
| 3.6.9 场地的竖向设计应有利于雨水的收集或排放，应有效组织雨水的下渗、滞蓄或再利用；对大于10hm2的场地应进行雨水控制利用专项设计。 | □满足 | □是、□否 | □满足/□不满足 |  |
| 3.6.10 建筑内外均应设置便于识别和使用的标识系统。 | □满足 | □是、□否 | □满足/□不满足 |  |
| 3.6.11生活垃圾应分类收集，垃圾容器和收集点的设置应合理并应与周围景观协调。 | □满足 | □是、□否 | □满足/□不满足 |  |

注：各专业所有项均需满足，视为通过。
<br>
编制：（建筑专业签字） 校对： 审核：
<br>
单位（每页均盖章）： 日期： 年 月 日
<br>`


const chapter24 = `# 24.装配式设计：
（或者按照各地相关要求叙述装配式说明部分、写更详细装配式设计专篇）
## 24.1项目概况：

| 建设地点 | 辽宁省沈阳市 | 辽宁省沈阳市 | 建筑性质 | 公建 办公 |
| --- | --- | --- | --- | --- |
| 总建筑面积（m2） | 23000 | 地上20000 | 建筑高度（m） | 80 |
| 总建筑面积（m2） | 23000 | 地下3000 | 建筑高度（m） | 80 |
| 建筑层数（层） | 地上24层、地下1层 | 地上24层、地下1层 | 结构形式 | 钢筋混凝土框架 |
| 建筑抗震等级 | 钢筋混凝土框架三级，剪力墙二级 | 钢筋混凝土框架三级，剪力墙二级 | 抗震设防烈度 | 7度 |
| 采用装配式部位 | 预制柱、预制梁、叠合楼板、预制楼梯、内隔墙采用ALC条板 | 预制柱、预制梁、叠合楼板、预制楼梯、内隔墙采用ALC条板 | 预制柱、预制梁、叠合楼板、预制楼梯、内隔墙采用ALC条板 | 预制柱、预制梁、叠合楼板、预制楼梯、内隔墙采用ALC条板 |
| 装配率 | 50% | 50% | 50% | 50% |

## 24.2设计依据：
24.2.1《沈阳市大力发展装配式建筑工作方案》沈政办发[2018]28号文件（XX省市关于装配率的文件，预制率、装配绿的数据要求）
24.2.2《沈阳市装配式建筑装配率计算细则》沈建发[2018]195号文件
24.2.3相关标准：
a.《装配式混凝土建筑技术标准》GB/T51231-2016
b.《装配式建筑评价标准》GB/T51129-2017
……
## 24.3 设计内容：
24.3.1 总平面设计
a.外部运输条件:预制构件的运输距离宜控制在150km 以内，本项目建设地点距预制构件厂运输距高为XX km，外部道路交通便捷。
b.内部运输条件:规划场地内的消防环路可利用作为施工临时通道，满足构件运输车辆转弯半径的要求，施工单位在施工现场及道路硬化工程中，应保证路面满足运输车辆的荷载要求。
c.构件存放与吊装:施工组织设计应合理设置临时堆放场地及塔吊位置，并设置安全可靠的维护设施防止构件变形开裂、倾覆、掉落。
24.3.2拆分部位：（根据具体项目描述）
a.框架柱：±0.000以上首层框架柱现浇，首层以上采用预制；
b.剪力墙：采用现浇；
c.楼梯：二层以上预制；其余楼板全部拆分；
d.楼板：正负零以上各层楼板均采用叠合楼板；
e.框架梁：除卫生间、楼梯间、电梯间等特殊部位，各层楼双向主次梁全部拆分；
f.内隔墙采用ALC条板墙体（或者免抹灰高精度砌块，看当地政策是否计算装配率）。
24.3.3 保温材料：幕墙采用岩棉板保温，保温层厚度满足XX地区建筑围护结构节能设计要求。
24.3.4 幕墙材料满足结构安全性、耐久性及环境保护要求，并采用耐火极限符合《建筑防火通用规范》GB55037-2022、《建筑设计防火规范》GB50016-2014(2018年版)的材料。
24.3.5 室内装修材料满足《建筑内部装修设计防火规范》GB50222-2017和《民用建筑工程室内环境污染控制标准》GB50325-2020的规定。
24.3.6建筑平立面设计及预制构配件满足《装配式混凝土建筑技术标准》GB/T51231-2016的要求。
24.3.7 与预制构件发生关系的建筑设备及管线集中布置，受条件限制必须暗埋时，在叠合楼板现浇层及建筑垫层内设计；管线必须穿越预制构件时，构件内预留套管。
## 24.4装配率计算表（各地计算方式有所不同，结合实际情况做）`


export const chapterTemplateMap: Record<number, string> = {
  1: chapter1,
  2: chapter2,
  3: chapter3,
  4: chapter4,
  5: chapter5,
  6: chapter6,
  7: chapter7,
  8: chapter8,
  9: chapter9,
  10: chapter10,
  11: chapter11,
  12: chapter12,
  13: chapter13,
  14: chapter14,
  15: chapter15,
  16: chapter16,
  17: chapter17,
  18: chapter18,
  19: chapter19,
  20: chapter20,
  21: chapter21,
  22: chapter22,
  23: chapter23,
  24: chapter24,
  25: `# 25.海绵城市设计：
详见给排水专业及景观专业设计图纸。`,
  26: `# 26.附表：
技术经济指标：
| 序号 | 名称 | 单位 | 指标 | 备注 |
| --- | --- | --- | --- | --- |
| 1 | 总用地面积 | m2 |  |  |
| 2 | 建筑占地面积 | m2 |  |  |
| 3 | 总建筑面积 | m2 |  |  |
|  | 地上建筑面积 | m2 |  | 计入容积率 |
|  | 地下建筑面积 | m2 |  | 不计入容积率（或XXX部分计入容积率） |
| 4 | 停车位 | 辆 |  |  |
|  | 地上停车位 | 辆 |  |  |
|  | 地下停车位 | 辆 |  |  |
| 5 | 容积率 |  |  |  |
| 6 | 覆盖率 |  |  |  |
| 7 | 绿地率 |  |  |  |
|  |  |  |  |  |`
}

export type ChapterTemplateEntry = { template: string; structure?: string, feature?: string, requirement?: string }

const structure4 = `
4.1 材料及选型
4.1.1 外墙
4.1.2 内墙
4.1.3 湿区墙体
4.2 构造要求
4.2.1 隔墙顶部
4.2.2 结构构件
4.2.3 门窗洞口
4.2.4 室内管井
4.2.5 穿墙洞口
4.2.6 小尺寸墙垛
4.2.7 砌体-混凝土拉结
4.2.8 设备固定加固
4.3 墙体防水和防潮见本说明防水设计章节。
4.4 其他未注明构造按照国标图集《混凝土小型空心砌块填充墙建筑、结构构造》22J 102-2，《蒸压加气混凝土砌块、板材构造》13 J104，《轻集料空心砌块内隔墙》03J 114-1……中的要求执行。未尽事宜，按照相关施工及验收规范执行。`

const structure5 = `
5.1 设计依据
5.2 屋面防水和排水设计见本说明防水设计章节。
5.3 钢筋混凝土屋面构造做法：详见[ 建施- ]《装修、构造做法表》和节点详图，并满足以下要求：
5.3.1 保护层（包括缝隙和分格缝处理）
5.3.2 保温层
屋面保温材料厚度及物理性能详见节能设计专篇，屋面保温层施工时，应保证基层平整。
5.3.3 找坡层：（包括材料、找平和分格缝设置）
5.3.4 隔汽层（涉及材料、铺设和连接要求）
5.4 金属屋面
金属屋面的构造详见专业厂家图纸，厂家应使金属屋面达到设计的承载、保温、防火、防水和隔声等要求，做好该屋面构件与土建部分的连接，并向土建设计单位提供预埋件的设计要求。`

const structure6 = `
6.1 楼地面做法详见详见[ 建施-编号 ]（保留“编号”字样）《装修、构造做法表》和节点详图。
6.2 楼层和地面防水防潮见本说明防水工程章节。
6.3 管井门和风井混凝土门槛
6.4 设备用房门挡水门槛
6.5 防水楼地面
6.6 楼地面回填土`

const structure7 = `
7.1 本工程内外门窗、隔断的材料、颜色、开启方式和耐火等级详见建施门窗表。（总结：材料、颜色、开启方式和耐火等级以门窗表为准。）
7.2 门窗立面图、玻璃隔断立面图仅表示门窗、隔断的立面分格示意及开启方式，其型材构件尺寸、截面大小、构造节点和安装图等应由生产厂家进行深化设计并满足强度、抗风、防水、保温、气密、水密等相关要求。（分工、责任）
7.3 门窗表中的尺寸为门窗洞口尺寸，门窗加工尺寸应参照门窗立面图和装修面厚度由承包商予以调整，并经实地测量核对数量后再加工制作。（加工尺寸需根据洞口尺寸、立面图和装修厚度调整，并经实地测量确认。）
7.4 木门材料与工艺（木材干燥处理含水率限值及油漆施工步骤要求。）
7.5 玻璃类型与安全处理（临空位置用夹层玻璃、普通隔断用钢化玻璃，边缘需切角打磨。）
7.6 防撞标志（全玻璃门、落地窗等在0.85~1.50m高度设防撞提示标志。）
7.7 安全玻璃（遵照国家及地方标准，如JGJ113-2015和安全玻璃管理规定。）
7.8 门窗性能（依据国标规定保温、气密、水密、抗风压等性能等级要求。）
a.保温性能不低于6级，具体指标见节能设计专篇；
b.气密性不低于6级；
c.水密性不低于3级；
d.抗风压性能不低于3级；
e.空气声隔声性能不低于3级；
7.9 开启装置（不便开启窗设手动装置，配置角度调节，应急窗具手动联动功能。）
7.10 窗台板`

const structure8 = `
8.1 幕墙类型与材料规格（玻璃幕墙、金属幕墙、陶土板幕墙的具体材料类型、规格、性能、表面）
8.2 幕墙规范（幕墙的设计、制作和安装必须遵循的国家及行业标准。）
8.3 幕墙玻璃（幕墙玻璃需执行的建筑玻璃应用技术规范和安全玻璃管理规定）
8.4 深化设计（说明幕墙立面图的内容范围，具体性能参数需由深化设计单位根据地理气候等条件设计。）
8.5 安装预埋（要求幕墙深化设计单位进行防水、防火等密闭设计，并提供预埋件设计图）
8.6 防火封堵（幕墙防火墙、楼板缝隙的防火封堵材料和构造要求）
8.7 玻璃幕墙性能（列出玻璃幕墙在保温、气密性、水密性、抗风压和隔声等方面的性能等级。）
8.8 非透明内衬
8.9 开启扇防脱落（强调玻璃幕墙外开启扇应采取防脱落措施，具体由厂家二次设计）
8.10 玻璃采光顶（规定玻璃采光顶由专业厂家设计，并详细说明玻璃类型、防脱落和防冷凝水措施）
8.11 玻璃雨棚（明确玻璃雨棚需符合相关标准，包括玻璃类型、自洁净性能及耐火要求。）
`

const structure9 = `
9.1 室内装修
9.1.1 各部分室内装修详见[ 建施-编号 ]（保留“编号”字样）《室内装修材料选用表》和《室内外装修构造做法表》。
9.1.2 基层处理（混凝土基层，素水泥浆或界面处理剂）
9.1.3 有水房间（楼面或地面、内墙设防水层，顶棚设置防潮层）
9.1.4 吊顶房间（抹灰高度与吊杆预留）
9.1.5 楼地面伸缩缝（混凝土楼地面的垫层和面层）
9.1.6 降板垫层（轻骨料混凝土）
9.1.7 管井砌筑（随砌随抹、二次浇筑）
9.1.8 卫生间隔断（成品隔断、挂物钩）
9.1.9 内墙抗裂（加设玻纤网布）
9.1.10 材料规范（GB 502220、GB 55016、GB 50325、GB 50210，及对应的地方规范）
9.1.11 标识系统（仅明确原则，另详专项设计图纸）

9.2 室外装修
9.2.1 室外装修详见[ 建施-编号 ]（保留“编号”字样）立面图纸和[ 建施-编号 ]（保留“编号”字样）《室内外装修构造做法表》。
9.2.2 外露管道（颜色同外墙）
9.2.3 外墙分隔缝（涂料装饰抹灰面层、不同墙体材料交界处）
9.2.4 外墙抗裂（不同墙体结构材料交界处）

9.3 材料封样（施工单位提供样板，封样，验收）
`

const sturcture10 = `
10.1 电梯数量()
本工程选用垂直电梯共[  ]台（其中消防电梯[  ]部，无障碍电梯[  ]部）；自动扶梯[  ]部。
10.2 电梯参数
 电梯的参数，包括载重、速度、底坑深度、顶站高度的等见电梯选用表。
10.3 安装条件（预埋件、预留孔、井道尺寸、底坑尺寸）
10.4 节能措施（电梯节能运行）
10.5 消防电梯（GB /T 26456、）
10.6 无障碍电梯
10.7 轿厢装修（详见装修，电梯层门耐火极限，满足消防）
10.8 电梯选型表（仅提供标题）
`

const feature4 = `涉及材料性能时必须标注具体指标（如：蒸压加气混凝土砌块强度等级A5.0）`
const requirement4 = `生成“墙体工程”章节内容。描述非承重结构的墙体、材料选择（如砌体、混凝土）、保温隔热及施工工艺。避免重复屋面或防水设计内容，仅聚焦墙体特有工程机理。`

const feature5 = `涉及材料性能时必须标注具体指标（如：轻骨料混凝土（抗压强度≥0.3Mpa））`
const requeirement5 = `生成“屋面工程”章节内容。重点阐述屋面系统设计，包括结构形式（如平屋顶、坡屋顶）、防水排水方案、材料（如沥青瓦、金属板）及保温措施。从专业角度说明屋面与建筑整体的整合，避免与防水设计或楼地面工程重叠。`

const feature6 = `涉及材料性能时必须标注具体指标（如：C15混凝土）`
const requirement6 = `生成“楼地面工程”章节内容。涵盖楼地面构造类型（如架空地板、实心板）、材料（如混凝土、木材）、平整度要求及施工方法。强调建筑使用功能和舒适性，避免重复墙体或装修工程细节，仅讨论楼地面特有方面。`

const feature7 = `气密、水密、抗风压具体数值更多参考地理位置、气候分区相同的项目。
涉及产品、材料的性能指标和量化取值明确援引的国家规范标准。`
const requirement7 = `从建筑设计师角度，描述门窗类型（如铝合金、木窗）、隔断设计（如固定式、活动式）、安装标准及节能性能。避免与幕墙或装修工程重复，聚焦产品与材料选型及性能指标。`

const feature8 = `气密、水密、抗风压具体数值更多参考地理位置、气候分区相同的项目。
涉及产品、材料的性能指标和量化取值明确援引的国家规范标准。
注意聚焦施工图设计范畴，对深化设计明确要求，但不要加入深化设计单位负责的内容。
根据项目地点提示积or/台风等应对。`
const requirement8 = `从建筑设计师角度，描述门窗类型（如铝合金、木窗）、隔断设计（如固定式、活动式）、安装标准及节能性能。避免与幕墙或装修工程重复，聚焦产品与材料选型及性能指标。`

const feature9 = `涉及材料性能时必须标注具体指标（如：LC7.5轻骨料混凝土）`
const requirement9 = `描述室内外装修装饰材料、工艺（如涂料、铺装）和设计风格，从建筑设计师角度强调功能与美观平衡。避免重复标识、幕墙、门窗、隔断或防水设计内容，仅聚焦装修分项的设计工作和选材原则。`


const freature10 = `大多数项目为垂直电梯，电梯是解决点对点垂直运输的基础需求；自动扶梯的核心价值在于连续、快速地输送大规模垂直人流；而自动步道则专长于水平或微倾斜方向上长距离、省力地移动人流`
const requirement10 = `涵盖电梯类型（如客梯、货梯）、布局设计、安全标准和无障碍要求。从工程项目角度解释电梯与建筑结构的整合，避免与消防或无障碍设计重复，仅讨论电梯特有技术细节。`

export const promptParamsByTitle: Record<string, ChapterTemplateEntry> = {
  '设计依据': { template: chapterTemplateMap[1] },
  '工程概况': { template: chapterTemplateMap[2] },
  '墙体工程': { template: chapterTemplateMap[4], structure: structure4, feature: feature4, requirement: requirement4 },
  '屋面工程': { template: chapterTemplateMap[5], structure: structure5, feature: feature5, requirement: requeirement5 },
  '楼地面工程': { template: chapterTemplateMap[6], structure: structure6, feature: feature6, requirement: requirement6 },
  '门窗、隔断工程': { template: chapterTemplateMap[7], structure: structure7, feature: feature7, requirement: requirement7 },
  '幕墙、天窗、玻璃雨棚工程': { template: chapterTemplateMap[8], structure: structure8, feature: feature8, requirement: requirement8 },
  '装修工程': { template: chapterTemplateMap[9], structure: structure9, feature: feature9, requirement: requirement9 },
  '电梯工程': { template: chapterTemplateMap[10], structure: sturcture10, feature: freature10, requirement: requirement10 },
  '消防设计': { template: chapterTemplateMap[11] },
  '无障碍设计': { template: chapterTemplateMap[12] },
  '防水设计': { template: chapterTemplateMap[13] },
  '安全防护设计': { template: chapterTemplateMap[14] },
  '隔声、降噪、减震设计': { template: chapterTemplateMap[15] },
  '构件防腐及油漆粉刷工程': { template: chapterTemplateMap[17] },
  '工种配合和施工要点': { template: chapterTemplateMap[19] },
  '人防设计': { template: chapterTemplateMap[20] },
  '节能设计': { template: chapterTemplateMap[21] },
  '碳排放计算和可再生能源利用': { template: chapterTemplateMap[22] },
  '绿色建筑设计': { template: chapterTemplateMap[23] },
  '装配式设计': { template: chapterTemplateMap[24] },
  '海绵城市设计': { template: chapterTemplateMap[25] },
  '附表': { template: chapterTemplateMap[26] },
}


