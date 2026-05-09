package com.aiid.aidoc.api.dto;

import lombok.Data;
import java.util.List;

@Data
public class ReviewManifestResponse {
    private String reviewId;
    private String documentName;
    private String ossFileKey;
    private String reviewFileUrl;
    private String standardsUrl;
    private List<String> dimensions;
}
