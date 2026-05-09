package com.aiid.aidoc.api.dto;

import lombok.Data;

@Data
public class ClauseCreateRequest {
    private String standardId;
    private String clauseNumber;
    private String title;
    private String content;
    private java.util.List<String> tags;
}
