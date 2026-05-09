package com.aiid.aidoc.model.entity;

import com.aiid.aidoc.model.handler.JsonbTypeHandler;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("clause")
public class Clause {
    @TableId
    private String id;
    private String standardId;
    private String clauseNumber;
    private String title;
    private String content;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private String tags;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
