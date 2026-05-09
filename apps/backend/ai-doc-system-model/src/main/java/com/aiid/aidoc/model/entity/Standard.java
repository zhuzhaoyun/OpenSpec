package com.aiid.aidoc.model.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("standard")
public class Standard {
    @TableId
    private String id;
    private String number;
    private String name;
    private String profession;
    private String status;
    private String supersededBy;
    private String description;
    private String userId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
