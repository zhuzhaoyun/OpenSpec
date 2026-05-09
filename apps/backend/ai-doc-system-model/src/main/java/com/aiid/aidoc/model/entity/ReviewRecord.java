package com.aiid.aidoc.model.entity;

import com.aiid.aidoc.model.handler.JsonbTypeHandler;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("review_record")
public class ReviewRecord {
    @TableId
    private String id;
    private String userId;
    private String documentName;
    /**
     * 兼容字段：审查流程已不再读写。
     */
    @Deprecated
    private String content;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private String dimensions;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private String standardIds;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private String summary;

    private String status;
    private String errorMessage;
    private String externalRequestId;
    private String ossFileKey;
    private String accessToken;
    private String clawithSessionId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
