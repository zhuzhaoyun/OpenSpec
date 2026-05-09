-- ============================================
-- PostgreSQL 数据库初始化脚本
-- ============================================
-- 创建时间: 2024-02-07
-- 版本: 2.0.0
-- 说明: 从 MySQL 迁移到 PostgreSQL 的初始化脚本
-- 特点: 幂等设计，可重复执行
-- ============================================

-- 通用触发器函数：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 0. 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(200) NOT NULL,
  password VARCHAR(200) NOT NULL,
  nickname VARCHAR(100),
  avatar VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_users_email ON users(email);

-- 创建触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 1. 文档表
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  project_info JSONB,
  meta_tags JSONB,
  version INT DEFAULT 0,
  last_modified_by VARCHAR(50),
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_deleted ON documents(is_deleted);

-- 创建全文搜索索引（使用 GIN）
CREATE INDEX IF NOT EXISTS idx_documents_name_gin ON documents USING gin(to_tsvector('simple', name));

-- 创建触发器
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. 文档块表
CREATE TABLE IF NOT EXISTS document_blocks (
  id VARCHAR(50) PRIMARY KEY,
  document_id VARCHAR(50) NOT NULL,
  block_type VARCHAR(20) NOT NULL CHECK (block_type IN ('heading_1', 'heading_2', 'heading_3', 'heading_4', 'paragraph', 'table', 'list_item', 'code_block')),
  block_name VARCHAR(200) NOT NULL,
  order_key VARCHAR(100) NOT NULL,
  parent_id VARCHAR(50),
  level INT DEFAULT 1,
  content TEXT,
  doc_reference JSONB,
  chunk_reference JSONB,
  metadata JSONB,
  is_deleted BOOLEAN DEFAULT FALSE,
  creator_id VARCHAR(50),
  modifier_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_blocks_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_document_blocks_parent FOREIGN KEY (parent_id) REFERENCES document_blocks(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_document_blocks_document_order ON document_blocks(document_id, order_key);
CREATE INDEX IF NOT EXISTS idx_document_blocks_parent ON document_blocks(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_blocks_type ON document_blocks(document_id, block_type);
CREATE INDEX IF NOT EXISTS idx_document_blocks_deleted ON document_blocks(document_id, is_deleted);

-- 创建全文搜索索引
CREATE INDEX IF NOT EXISTS idx_document_blocks_content_gin ON document_blocks USING gin(to_tsvector('simple', content));

-- 创建触发器
DROP TRIGGER IF EXISTS update_document_blocks_updated_at ON document_blocks;
CREATE TRIGGER update_document_blocks_updated_at
    BEFORE UPDATE ON document_blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. 模板标签表
CREATE TABLE IF NOT EXISTS template_tags (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('profession', 'business_type', 'custom')),
  user_id BIGINT,
  is_system BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_template_tags_name_category_user UNIQUE (name, category, user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_template_tags_category ON template_tags(category);
CREATE INDEX IF NOT EXISTS idx_template_tags_user ON template_tags(user_id);

-- 部分唯一索引：修复 user_id 为 NULL 时 UNIQUE 约束失效的问题
-- PostgreSQL 中 NULL != NULL，导致 ON CONFLICT 对系统标签不生效
CREATE UNIQUE INDEX IF NOT EXISTS uk_template_tags_system_null_user
ON template_tags (name, category) WHERE user_id IS NULL;

-- 创建触发器
DROP TRIGGER IF EXISTS update_template_tags_updated_at ON template_tags;
CREATE TRIGGER update_template_tags_updated_at
    BEFORE UPDATE ON template_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE template_tags IS '模板标签表';
COMMENT ON COLUMN template_tags.name IS '标签名称';
COMMENT ON COLUMN template_tags.category IS '标签分类：profession-专业，business_type-业态，custom-自定义';
COMMENT ON COLUMN template_tags.user_id IS '创建用户ID，系统标签为NULL';
COMMENT ON COLUMN template_tags.is_system IS '是否系统标签';
COMMENT ON COLUMN template_tags.sort_order IS '排序顺序';

-- 4. 文档模板表
CREATE TABLE IF NOT EXISTS document_template (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  file_path VARCHAR(500),
  file_name VARCHAR(200),
  file_size BIGINT,
  file_type VARCHAR(50),
  content TEXT,
  chapters JSONB,
  status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsing', 'extracting', 'saving', 'completed', 'success', 'failed')),
  error_message TEXT,
  user_id BIGINT NOT NULL,
  is_standard BOOLEAN DEFAULT FALSE,
  download_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_document_template_user_id ON document_template(user_id);
CREATE INDEX IF NOT EXISTS idx_document_template_status ON document_template(status);
CREATE INDEX IF NOT EXISTS idx_document_template_is_standard ON document_template(is_standard);
CREATE INDEX IF NOT EXISTS idx_document_template_updated_at ON document_template(updated_at);

-- 创建全文搜索索引
CREATE INDEX IF NOT EXISTS idx_document_template_name_desc_gin ON document_template USING gin(to_tsvector('simple', name || ' ' || COALESCE(description, '')));

-- 创建触发器
DROP TRIGGER IF EXISTS update_document_template_updated_at ON document_template;
CREATE TRIGGER update_document_template_updated_at
    BEFORE UPDATE ON document_template
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE document_template IS '文档模板表';
COMMENT ON COLUMN document_template.name IS '模板名称';
COMMENT ON COLUMN document_template.description IS '模板描述';
COMMENT ON COLUMN document_template.file_path IS '文件存储路径';
COMMENT ON COLUMN document_template.file_name IS '原始文件名';
COMMENT ON COLUMN document_template.file_size IS '文件大小（字节）';
COMMENT ON COLUMN document_template.file_type IS '文件类型（如：docx, pdf）';
COMMENT ON COLUMN document_template.content IS '模板内容（解释后的文本）';
COMMENT ON COLUMN document_template.chapters IS '章节目录结构';
COMMENT ON COLUMN document_template.status IS '状态：uploaded-已上传，parsing-文档解析中，extracting-章节提取中，saving-数据保存中，completed-处理完成，success-解释成功，failed-解释失败';
COMMENT ON COLUMN document_template.error_message IS '错误信息（解释失败时）';
COMMENT ON COLUMN document_template.user_id IS '上传用户ID';
COMMENT ON COLUMN document_template.is_standard IS '是否标准模板（供下载）';
COMMENT ON COLUMN document_template.download_count IS '下载次数';

-- 5. 文档模板与标签关联表
CREATE TABLE IF NOT EXISTS document_template_tags (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_template_tags_template FOREIGN KEY (template_id) REFERENCES document_template(id) ON DELETE CASCADE,
  CONSTRAINT fk_document_template_tags_tag FOREIGN KEY (tag_id) REFERENCES template_tags(id) ON DELETE CASCADE,
  CONSTRAINT uk_document_template_tags_template_tag UNIQUE (template_id, tag_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_document_template_tags_template ON document_template_tags(template_id);
CREATE INDEX IF NOT EXISTS idx_document_template_tags_tag ON document_template_tags(tag_id);

-- 添加表注释
COMMENT ON TABLE document_template_tags IS '文档模板与标签关联表';
COMMENT ON COLUMN document_template_tags.template_id IS '模板ID';
COMMENT ON COLUMN document_template_tags.tag_id IS '标签ID';

-- 6. CAD模板表
CREATE TABLE IF NOT EXISTS cad_template (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(200) NOT NULL,
  file_size BIGINT,
  file_type VARCHAR(50),
  user_id BIGINT NOT NULL,
  download_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_cad_template_user UNIQUE (user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_cad_template_user_id ON cad_template(user_id);

-- 创建触发器
DROP TRIGGER IF EXISTS update_cad_template_updated_at ON cad_template;
CREATE TRIGGER update_cad_template_updated_at
    BEFORE UPDATE ON cad_template
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE cad_template IS 'CAD模板表';
COMMENT ON COLUMN cad_template.name IS 'CAD模板名称';
COMMENT ON COLUMN cad_template.description IS '模板描述';
COMMENT ON COLUMN cad_template.file_path IS '文件存储路径';
COMMENT ON COLUMN cad_template.file_name IS '原始文件名';
COMMENT ON COLUMN cad_template.file_size IS '文件大小（字节）';
COMMENT ON COLUMN cad_template.file_type IS '文件类型（如：dwg, dxf）';
COMMENT ON COLUMN cad_template.user_id IS '上传用户ID';
COMMENT ON COLUMN cad_template.download_count IS '下载次数';
COMMENT ON CONSTRAINT uk_cad_template_user ON cad_template IS '每个用户只保留一份CAD模板';

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE 'Database schema initialized successfully!';
END $$;

-- ============================================
-- 7. 用户记忆表（长期记忆 - pgvector）
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS user_memory (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1024),
  chapter_name VARCHAR(200),
  source_type VARCHAR(50) DEFAULT 'requirement',
  category VARCHAR(50) DEFAULT 'other',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_source_type ON user_memory(user_id, source_type);

-- 兼容升级：已有表添加 category 列
ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other';

-- ============================================
-- 8. 操作记录表
-- ============================================
CREATE TABLE IF NOT EXISTS operation_record (
    id            BIGSERIAL PRIMARY KEY,
    user_id       VARCHAR(50)   NOT NULL,
    document_id   VARCHAR(100)  NOT NULL,
    chapter_name  VARCHAR(200),
    action_type   VARCHAR(50)   NOT NULL,
    action_detail TEXT,
    context       JSONB         DEFAULT '{}',
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_record_user_id ON operation_record(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_record_document ON operation_record(user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_operation_record_action ON operation_record(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_operation_record_time ON operation_record(created_at DESC);

-- ============================================
-- 9. 标准表（规范标准库）
-- ============================================
CREATE TABLE IF NOT EXISTS standard (
  id VARCHAR(50) PRIMARY KEY,
  number VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  profession VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
  superseded_by VARCHAR(200),
  description TEXT,
  user_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_standard_profession ON standard(profession);
CREATE INDEX IF NOT EXISTS idx_standard_number ON standard(number);
CREATE INDEX IF NOT EXISTS idx_standard_status ON standard(status);

DROP TRIGGER IF EXISTS update_standard_updated_at ON standard;
CREATE TRIGGER update_standard_updated_at
    BEFORE UPDATE ON standard
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 10. 条文表
CREATE TABLE IF NOT EXISTS clause (
  id VARCHAR(50) PRIMARY KEY,
  standard_id VARCHAR(50) NOT NULL,
  clause_number VARCHAR(50),
  title VARCHAR(200),
  content TEXT,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clause_standard FOREIGN KEY (standard_id) REFERENCES standard(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clause_standard_id ON clause(standard_id);
CREATE INDEX IF NOT EXISTS idx_clause_clause_number ON clause(clause_number);

DROP TRIGGER IF EXISTS update_clause_updated_at ON clause;
CREATE TRIGGER update_clause_updated_at
    BEFORE UPDATE ON clause
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 11. 检查点表
CREATE TABLE IF NOT EXISTS checkpoint (
  id VARCHAR(50) PRIMARY KEY,
  clause_id VARCHAR(50) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'suggestion')),
  match_keywords JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_checkpoint_clause FOREIGN KEY (clause_id) REFERENCES clause(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checkpoint_clause_id ON checkpoint(clause_id);

DROP TRIGGER IF EXISTS update_checkpoint_updated_at ON checkpoint;
CREATE TRIGGER update_checkpoint_updated_at
    BEFORE UPDATE ON checkpoint
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 12. 审查记录表
CREATE TABLE IF NOT EXISTS review_record (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  document_name VARCHAR(200),
  content TEXT,
  dimensions JSONB DEFAULT '[]',
  standard_ids JSONB DEFAULT '[]',
  summary JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  external_request_id VARCHAR(100),
  oss_file_key VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_review_record_user_id ON review_record(user_id);
CREATE INDEX IF NOT EXISTS idx_review_record_status ON review_record(status);
CREATE INDEX IF NOT EXISTS idx_review_record_created_at ON review_record(created_at DESC);

DROP TRIGGER IF EXISTS update_review_record_updated_at ON review_record;
CREATE TRIGGER update_review_record_updated_at
    BEFORE UPDATE ON review_record
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Clawith integration columns
ALTER TABLE review_record ADD COLUMN IF NOT EXISTS access_token VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_access_token ON review_record(access_token);

ALTER TABLE review_record ADD COLUMN IF NOT EXISTS clawith_session_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_review_clawith_session ON review_record(clawith_session_id);

-- 13. 审查问题表
CREATE TABLE IF NOT EXISTS review_issue (
  id VARCHAR(50) PRIMARY KEY,
  record_id VARCHAR(50) NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('critical', 'warning', 'suggestion')),
  dimension VARCHAR(20) CHECK (dimension IN ('compliance', 'completeness', 'terminology', 'consistency')),
  title VARCHAR(200),
  description TEXT,
  original_snippet TEXT,
  snippet_start INT,
  chapter_ref VARCHAR(200),
  standard_ref VARCHAR(200),
  standard_clause VARCHAR(50),
  standard_text TEXT,
  suggestion_text TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_issue_record FOREIGN KEY (record_id) REFERENCES review_record(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_issue_record_id ON review_issue(record_id);
CREATE INDEX IF NOT EXISTS idx_review_issue_status ON review_issue(record_id, status);
