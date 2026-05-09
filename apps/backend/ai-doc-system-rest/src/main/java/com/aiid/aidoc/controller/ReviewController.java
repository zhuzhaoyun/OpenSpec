package com.aiid.aidoc.controller;

import com.aiid.aidoc.api.dto.ClawithSessionUpdateRequest;
import com.aiid.aidoc.api.dto.PaginationResponse;
import com.aiid.aidoc.api.dto.ReviewCreateRequest;
import com.aiid.aidoc.api.dto.ReviewManifestResponse;
import com.aiid.aidoc.api.dto.ReviewResultsUpdateRequest;
import com.aiid.aidoc.api.dto.ReviewSourceAccessResponse;
import com.aiid.aidoc.config.AppProperties;
import com.aiid.aidoc.model.common.ApiResponse;
import com.aiid.aidoc.model.entity.ReviewIssue;
import com.aiid.aidoc.model.entity.ReviewRecord;
import com.aiid.aidoc.service.ReviewService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;
    private final ObjectMapper objectMapper;
    private final AppProperties appProperties;

    /**
     * 发起审查
     * 当前为同步模式，直接返回 status=pending 的记录。
     * 后续对接外部 AI 智能体时，此处将通过 WebSocket 发送审查请求，
     * 并在收到结果后更新记录和写入问题列表。
     */
    @PostMapping
    public ApiResponse<Map<String, Object>> createReview(
            @RequestBody ReviewCreateRequest body,
            HttpServletRequest request
    ) {
        String userId = (String) request.getAttribute("userId");
        try {
            ReviewRecord record = reviewService.create(
                    userId, body.getDocumentName(),
                    body.getDimensions(), body.getStandardIds(),
                    body.getOssFileKey(), body.getClawithSessionId()
            );
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", record.getId());
            result.put("status", record.getStatus());
            String baseUrl = appProperties.getBaseUrl().replaceAll("/+$", "");
            result.put("manifestUrl",
                    baseUrl + "/api/v1/reviews/" + record.getId()
                    + "/manifest?token=" + record.getAccessToken());
            return ApiResponse.created(result);
        } catch (IllegalArgumentException e) {
            return ApiResponse.message(400, e.getMessage());
        }
    }

    /**
     * 查询审查结果（含问题列表）
     */
    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> getReview(@PathVariable String id, HttpServletRequest request) {
        String userId = (String) request.getAttribute("userId");
        ReviewRecord record = reviewService.getById(id);
        if (record == null || userId == null || !userId.equals(record.getUserId())) {
            return ApiResponse.message(404, "审查记录不存在");
        }
        List<ReviewIssue> issues = reviewService.getIssues(id);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", record.getId());
        result.put("userId", record.getUserId());
        result.put("documentName", record.getDocumentName());
        result.put("status", record.getStatus());
        result.put("errorMessage", record.getErrorMessage());
        result.put("ossFileKey", record.getOssFileKey());
        result.put("clawithSessionId", record.getClawithSessionId());
        result.put("createdAt", record.getCreatedAt());
        result.put("updatedAt", record.getUpdatedAt());

        // 解析 JSONB 字段
        try {
            result.put("dimensions", objectMapper.readValue(
                    record.getDimensions() != null ? record.getDimensions() : "[]",
                    new TypeReference<List<String>>() {}));
        } catch (Exception e) {
            result.put("dimensions", List.of());
        }
        try {
            result.put("standardIds", objectMapper.readValue(
                    record.getStandardIds() != null ? record.getStandardIds() : "[]",
                    new TypeReference<List<String>>() {}));
        } catch (Exception e) {
            result.put("standardIds", List.of());
        }
        try {
            result.put("summary", record.getSummary() != null
                    ? objectMapper.readValue(record.getSummary(), Map.class)
                    : Map.of());
        } catch (Exception e) {
            result.put("summary", Map.of());
        }

        // 组装 issues
        List<Map<String, Object>> issueList = issues.stream().map(iss -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", iss.getId());
            m.put("recordId", iss.getRecordId());
            m.put("severity", iss.getSeverity());
            m.put("dimension", iss.getDimension());
            m.put("title", iss.getTitle());
            m.put("description", iss.getDescription());
            m.put("originalSnippet", iss.getOriginalSnippet());
            m.put("snippetStart", iss.getSnippetStart());
            m.put("chapterRef", iss.getChapterRef());
            m.put("standardRef", iss.getStandardRef());
            m.put("standardClause", iss.getStandardClause());
            m.put("standardText", iss.getStandardText());
            m.put("suggestionText", iss.getSuggestionText());
            m.put("status", iss.getStatus());
            return m;
        }).toList();
        result.put("issues", issueList);

        return ApiResponse.success(result);
    }

    /**
     * 获取审查源文件的受控访问地址
     */
    @GetMapping("/{id}/source-access")
    public ApiResponse<ReviewSourceAccessResponse> getReviewSourceAccess(
            @PathVariable String id,
            HttpServletRequest request
    ) {
        String userId = (String) request.getAttribute("userId");
        try {
            ReviewSourceAccessResponse response = reviewService.getSourceAccess(id, userId);
            if (response == null) {
                return ApiResponse.message(404, "审查记录不存在");
            }
            return ApiResponse.success(response);
        } catch (IllegalStateException e) {
            return ApiResponse.message(500, e.getMessage());
        }
    }

    /**
     * 获取审查清单（Agent 内部使用，通过 access token 鉴权）
     */
    @GetMapping("/{id}/manifest")
    public ApiResponse<ReviewManifestResponse> getManifest(
            @PathVariable String id,
            @RequestParam("token") String token
    ) {
        try {
            ReviewManifestResponse manifest = reviewService.getManifest(id, token);
            return ApiResponse.success(manifest);
        } catch (IllegalArgumentException e) {
            return ApiResponse.message(400, e.getMessage());
        }
    }

    /**
     * 获取源文件（Agent 内部使用，通过 access token 鉴权）
     */
    @GetMapping("/{id}/source-file")
    public void getSourceFile(
            @PathVariable String id,
            @RequestParam("token") String token,
            HttpServletResponse response
    ) throws IOException {
        try {
            ReviewRecord record = reviewService.getById(id);
            if (record == null || token == null || !token.equals(record.getAccessToken())) {
                response.sendError(400, "无效的访问令牌");
                return;
            }
            byte[] bytes = reviewService.getSourceFile(id, token);
            String filename = record.getDocumentName() != null ? record.getDocumentName() : "source.md";
            String contentType = filename.toLowerCase().endsWith(".md")
                    || filename.toLowerCase().endsWith(".txt")
                    ? "text/plain; charset=UTF-8" : "application/octet-stream";
            response.setContentType(contentType);
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                    "inline; filename*=UTF-8''" + URLEncoder.encode(filename, StandardCharsets.UTF_8));
            response.getOutputStream().write(bytes);
            response.getOutputStream().flush();
        } catch (IllegalArgumentException e) {
            response.sendError(400, e.getMessage());
        }
    }

    /**
     * 获取规范文件（Agent 内部使用，通过 access token 鉴权）
     */
    @GetMapping("/{id}/standards-file")
    public void getStandardsFile(
            @PathVariable String id,
            @RequestParam("token") String token,
            HttpServletResponse response
    ) throws IOException {
        try {
            byte[] bytes = reviewService.getStandardsFile(id, token);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                    "inline; filename*=UTF-8''standards.json");
            response.getOutputStream().write(bytes);
            response.getOutputStream().flush();
        } catch (IllegalArgumentException e) {
            response.sendError(400, e.getMessage());
        }
    }

    /**
     * 更新审查结果（Agent 内部使用，JWT 鉴权）
     */
    @PutMapping("/{id}/results")
    public ApiResponse<Void> updateResults(
            @PathVariable String id,
            @RequestBody ReviewResultsUpdateRequest body,
            HttpServletRequest request
    ) {
        String userId = (String) request.getAttribute("userId");
        try {
            reviewService.updateResults(id, userId, body);
            return ApiResponse.success(null);
        } catch (IllegalArgumentException e) {
            return ApiResponse.message(404, e.getMessage());
        } catch (IllegalStateException e) {
            return ApiResponse.message(409, e.getMessage());
        }
    }

    /**
     * 更新 Clawith session（Agent 内部使用，JWT 鉴权）
     */
    @PatchMapping("/{id}/clawith-session")
    public ApiResponse<Void> updateClawithSession(
            @PathVariable String id,
            @RequestBody ClawithSessionUpdateRequest body,
            HttpServletRequest request
    ) {
        String userId = (String) request.getAttribute("userId");
        try {
            reviewService.updateClawithSession(id, userId, body);
            return ApiResponse.success(null);
        } catch (IllegalArgumentException e) {
            return ApiResponse.message(400, e.getMessage());
        } catch (IllegalStateException e) {
            return ApiResponse.message(409, e.getMessage());
        }
    }

    /**
     * 审查历史列表
     */
    @GetMapping
    public ApiResponse<PaginationResponse<ReviewRecord>> listReviews(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "20") long pageSize,
            HttpServletRequest request
    ) {
        String userId = (String) request.getAttribute("userId");
        Page<ReviewRecord> p = reviewService.list(userId, page, pageSize);
        PaginationResponse<ReviewRecord> resp = new PaginationResponse<>();
        resp.setTotal(p.getTotal());
        resp.setPage(p.getCurrent());
        resp.setPageSize(p.getSize());
        resp.setList(p.getRecords() != null ? p.getRecords() : List.of());
        return ApiResponse.success(resp);
    }

    /**
     * 删除审查记录（级联删除问题列表）
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteReview(@PathVariable String id) {
        boolean ok = reviewService.delete(id);
        if (!ok) {
            return ApiResponse.message(404, "审查记录不存在");
        }
        return ApiResponse.message(200, "已删除");
    }

    /**
     * 更新问题状态（pending / resolved / ignored）
     */
    @PutMapping("/{recordId}/issues/{issueId}")
    public ApiResponse<ReviewIssue> updateIssueStatus(
            @PathVariable String issueId,
            @RequestBody Map<String, String> body
    ) {
        String status = body.get("status");
        if (status == null || (!status.equals("pending") && !status.equals("resolved") && !status.equals("ignored"))) {
            return ApiResponse.message(400, "无效的状态值，可选: pending / resolved / ignored");
        }
        ReviewIssue updated = reviewService.updateIssueStatus(issueId, status);
        if (updated == null) {
            return ApiResponse.message(404, "问题不存在");
        }
        return ApiResponse.success(updated);
    }
}
