package com.aiid.aidoc.api.dto;

import lombok.Data;
import java.util.List;

@Data
public class CheckpointRequest {
    private String clauseId;
    private String description;
    private String severity;
    private List<String> matchKeywords;
}
