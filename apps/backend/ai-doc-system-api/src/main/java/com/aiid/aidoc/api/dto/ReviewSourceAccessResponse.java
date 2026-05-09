package com.aiid.aidoc.api.dto;

import lombok.Data;

import java.time.Instant;

@Data
public class ReviewSourceAccessResponse {
    private String reviewId;
    private String documentName;
    private String ossFileKey;
    private String fileName;
    private String contentType;
    private String accessUrl;
    private Instant expiresAt;
}
