package com.aiid.aidoc.model.entity;

import com.aiid.aidoc.model.handler.JsonbTypeHandler;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("checkpoint")
public class Checkpoint {
    @TableId
    private String id;
    private String clauseId;
    private String description;
    private String severity;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private String matchKeywords;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
