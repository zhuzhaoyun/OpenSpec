package com.aiid.aidoc.service;

import com.aiid.aidoc.model.entity.ReviewIssue;
import com.aiid.aidoc.model.entity.ReviewRecord;
import com.aiid.aidoc.api.dto.ClawithSessionUpdateRequest;
import com.aiid.aidoc.api.dto.ReviewManifestResponse;
import com.aiid.aidoc.api.dto.ReviewResultsUpdateRequest;
import com.aiid.aidoc.api.dto.ReviewSourceAccessResponse;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

public interface ReviewService {
    ReviewRecord create(String userId, String documentName,
                        List<String> dimensions, List<String> standardIds,
                        String ossFileKey, String clawithSessionId);
    ReviewRecord getById(String id);
    List<ReviewIssue> getIssues(String recordId);
    Page<ReviewRecord> list(String userId, long page, long pageSize);
    boolean delete(String id);
    ReviewIssue updateIssueStatus(String issueId, String status);
    ReviewSourceAccessResponse getSourceAccess(String reviewId, String userId);
    ReviewManifestResponse getManifest(String reviewId, String accessToken);
    byte[] getSourceFile(String reviewId, String accessToken);
    byte[] getStandardsFile(String reviewId, String accessToken);
    void updateResults(String reviewId, String userId, ReviewResultsUpdateRequest body);
    void updateClawithSession(String reviewId, String userId, ClawithSessionUpdateRequest body);
}
