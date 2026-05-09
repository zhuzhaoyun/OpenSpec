package com.aiid.aidoc.api.dto;

import lombok.Data;
import java.util.List;

@Data
public class ReviewResultsUpdateRequest {
    /**
     * Raw JSON string — accepts any structure the agent produces.
     * Stored as-is in DB, returned to frontend for stats display.
     */
    private String summary;
    private List<ReviewIssueItem> issues;

    @Data
    public static class ReviewIssueItem {
        private String severity;
        private String dimension;
        private String title;
        private String description;
        private String originalSnippet;
        private Integer snippetStart;
        private String chapterRef;
        private String standardRef;
        private String standardClause;
        private String standardText;
        private String suggestionText;
    }
}
