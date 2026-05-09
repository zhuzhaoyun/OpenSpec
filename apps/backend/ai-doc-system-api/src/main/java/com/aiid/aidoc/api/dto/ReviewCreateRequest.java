package com.aiid.aidoc.api.dto;

import lombok.Data;
import java.util.List;

@Data
public class ReviewCreateRequest {
    private List<String> dimensions;
    private List<String> standardIds;
    private String documentName;
    private String ossFileKey;
    private String clawithSessionId;
}
