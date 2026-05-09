package com.aiid.aidoc.api.dto;

import lombok.Data;

@Data
public class StandardCreateRequest {
    private String number;
    private String name;
    private String profession;
    private String status;
    private String supersededBy;
    private String description;
}
