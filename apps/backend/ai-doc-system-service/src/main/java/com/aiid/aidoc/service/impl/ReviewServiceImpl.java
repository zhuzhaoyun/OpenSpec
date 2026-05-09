package com.aiid.aidoc.service.impl;

import com.aiid.aidoc.api.dto.ClawithSessionUpdateRequest;
import com.aiid.aidoc.api.dto.ReviewManifestResponse;
import com.aiid.aidoc.api.dto.ReviewResultsUpdateRequest;
import com.aiid.aidoc.api.dto.ReviewSourceAccessResponse;
import com.aiid.aidoc.config.AppProperties;
import com.aiid.aidoc.config.OssProperties;
import com.aiid.aidoc.model.entity.Checkpoint;
import com.aiid.aidoc.model.entity.Clause;
import com.aiid.aidoc.model.entity.ReviewIssue;
import com.aiid.aidoc.model.entity.ReviewRecord;
import com.aiid.aidoc.model.entity.Standard;
import com.aiid.aidoc.repository.mapper.CheckpointMapper;
import com.aiid.aidoc.repository.mapper.ClauseMapper;
import com.aiid.aidoc.repository.mapper.ReviewIssueMapper;
import com.aiid.aidoc.repository.mapper.ReviewRecordMapper;
import com.aiid.aidoc.repository.mapper.StandardMapper;
import com.aiid.aidoc.service.ReviewService;
import com.aliyun.oss.ClientBuilderConfiguration;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.common.auth.DefaultCredentialProvider;
import com.aliyun.oss.common.comm.SignVersion;
import com.aliyun.oss.model.OSSObject;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URL;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReviewServiceImpl implements ReviewService {

    private final ReviewRecordMapper reviewRecordMapper;
    private final ReviewIssueMapper reviewIssueMapper;
    private final StandardMapper standardMapper;
    private final ClauseMapper clauseMapper;
    private final CheckpointMapper checkpointMapper;
    private final ObjectMapper objectMapper;
    private final OssProperties ossProperties;
    private final AppProperties appProperties;
    private static final long SOURCE_ACCESS_EXPIRE_SECONDS = 300L;

    @Override
    public ReviewRecord create(String userId, String documentName,
                               List<String> dimensions, List<String> standardIds,
                               String ossFileKey, String clawithSessionId) {
        String normalizedDocumentName = documentName != null ? documentName.trim() : "";
        if (normalizedDocumentName.isBlank()) {
            throw new IllegalArgumentException("documentName 不能为空");
        }
        String lowerDocumentName = normalizedDocumentName.toLowerCase(Locale.ROOT);
        if (!lowerDocumentName.endsWith(".md") && !lowerDocumentName.endsWith(".txt")) {
            throw new IllegalArgumentException("仅支持 .md / .txt 文件");
        }
        String normalizedOssFileKey = ossFileKey != null ? ossFileKey.trim() : "";
        if (normalizedOssFileKey.isBlank()) {
            throw new IllegalArgumentException("ossFileKey 不能为空");
        }
        String lowerKey = normalizedOssFileKey.toLowerCase(Locale.ROOT);
        if (!lowerKey.endsWith(".md") && !lowerKey.endsWith(".txt")) {
            throw new IllegalArgumentException("仅支持 .md / .txt 文件");
        }

        ReviewRecord record = new ReviewRecord();
        record.setId(UUID.randomUUID().toString());
        record.setUserId(userId);
        record.setDocumentName(normalizedDocumentName);
        record.setOssFileKey(normalizedOssFileKey);
        record.setAccessToken(UUID.randomUUID().toString());
        record.setClawithSessionId(clawithSessionId != null ? clawithSessionId.trim() : null);
        try {
            record.setDimensions(objectMapper.writeValueAsString(dimensions != null ? dimensions : List.of()));
            record.setStandardIds(objectMapper.writeValueAsString(standardIds != null ? standardIds : List.of()));
        } catch (JsonProcessingException e) {
            record.setDimensions("[]");
            record.setStandardIds("[]");
        }
        record.setStatus("pending");
        record.setCreatedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        reviewRecordMapper.insert(record);
        return record;
    }

    @Override
    public ReviewRecord getById(String id) {
        return reviewRecordMapper.selectById(id);
    }

    @Override
    public List<ReviewIssue> getIssues(String recordId) {
        return reviewIssueMapper.selectList(
                new LambdaQueryWrapper<ReviewIssue>()
                        .eq(ReviewIssue::getRecordId, recordId)
                        .orderByAsc(ReviewIssue::getCreatedAt)
        );
    }

    @Override
    public Page<ReviewRecord> list(String userId, long page, long pageSize) {
        LambdaQueryWrapper<ReviewRecord> qw = new LambdaQueryWrapper<ReviewRecord>()
                .eq(ReviewRecord::getUserId, userId)
                .orderByDesc(ReviewRecord::getCreatedAt);
        Page<ReviewRecord> p = new Page<>(page, pageSize);
        return reviewRecordMapper.selectPage(p, qw);
    }

    @Override
    @Transactional
    public boolean delete(String id) {
        ReviewRecord existing = reviewRecordMapper.selectById(id);
        if (existing == null) return false;
        reviewIssueMapper.delete(
                new LambdaQueryWrapper<ReviewIssue>().eq(ReviewIssue::getRecordId, id)
        );
        reviewRecordMapper.deleteById(id);
        return true;
    }

    @Override
    public ReviewIssue updateIssueStatus(String issueId, String status) {
        ReviewIssue issue = reviewIssueMapper.selectById(issueId);
        if (issue == null) return null;
        issue.setStatus(status);
        reviewIssueMapper.updateById(issue);
        return issue;
    }

    @Override
    public ReviewManifestResponse getManifest(String reviewId, String accessToken) {
        ReviewRecord record = reviewRecordMapper.selectById(reviewId);
        if (record == null || accessToken == null
                || !accessToken.equals(record.getAccessToken())) {
            throw new IllegalArgumentException("无效的访问令牌");
        }
        if ("pending".equals(record.getStatus())) {
            record.setStatus("running");
            record.setUpdatedAt(LocalDateTime.now());
            reviewRecordMapper.updateById(record);
        }

        ReviewManifestResponse resp = new ReviewManifestResponse();
        resp.setReviewId(record.getId());
        resp.setDocumentName(record.getDocumentName());
        resp.setOssFileKey(record.getOssFileKey());
        resp.setDimensions(parseJsonList(record.getDimensions()));

        String baseUrl = appProperties.getBaseUrl().replaceAll("/+$", "");
        resp.setReviewFileUrl(baseUrl + "/api/v1/reviews/" + record.getId()
                + "/source-file?token=" + record.getAccessToken());
        resp.setStandardsUrl(baseUrl + "/api/v1/reviews/" + record.getId()
                + "/standards-file?token=" + record.getAccessToken());
        return resp;
    }

    @Override
    public byte[] getSourceFile(String reviewId, String accessToken) {
        ReviewRecord record = reviewRecordMapper.selectById(reviewId);
        if (record == null || accessToken == null
                || !accessToken.equals(record.getAccessToken())) {
            throw new IllegalArgumentException("无效的访问令牌");
        }
        String ossFileKey = normalize(record.getOssFileKey());
        if (ossFileKey.isBlank()) {
            throw new IllegalStateException("审查记录缺少 ossFileKey");
        }
        OSS ossClient = createOssClient();
        try {
            OSSObject obj = ossClient.getObject(ossProperties.getBucket(), ossFileKey);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            obj.getObjectContent().transferTo(buf);
            return buf.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("读取源文件失败", e);
        } finally {
            ossClient.shutdown();
        }
    }

    @Override
    public byte[] getStandardsFile(String reviewId, String accessToken) {
        ReviewRecord record = reviewRecordMapper.selectById(reviewId);
        if (record == null || accessToken == null
                || !accessToken.equals(record.getAccessToken())) {
            throw new IllegalArgumentException("无效的访问令牌");
        }
        try {
            List<String> standardIds = objectMapper.readValue(
                    record.getStandardIds() != null ? record.getStandardIds() : "[]",
                    new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
            List<StandardData> standards = new java.util.ArrayList<>();
            if (standardIds != null) {
                for (String stdId : standardIds) {
                    Standard std = standardMapper.selectById(stdId);
                    if (std == null) continue;
                    List<Clause> clauses = clauseMapper.selectList(
                            new LambdaQueryWrapper<Clause>().eq(Clause::getStandardId, stdId));
                    List<ClauseData> clauseDataList = new java.util.ArrayList<>();
                    for (Clause clause : clauses) {
                        List<Checkpoint> checkpoints = checkpointMapper.selectList(
                                new LambdaQueryWrapper<Checkpoint>().eq(Checkpoint::getClauseId, clause.getId()));
                        List<CheckpointData> checkpointDataList = new java.util.ArrayList<>();
                        for (Checkpoint cp : checkpoints) {
                            List<String> kw = parseJsonList(cp.getMatchKeywords());
                            checkpointDataList.add(new CheckpointData(
                                    cp.getDescription(), cp.getSeverity(), kw));
                        }
                        clauseDataList.add(new ClauseData(
                                clause.getClauseNumber(), clause.getTitle(),
                                clause.getContent(), checkpointDataList));
                    }
                    standards.add(new StandardData(std.getNumber(), std.getName(), clauseDataList));
                }
            }
            return objectMapper.writeValueAsBytes(standards);
        } catch (JsonProcessingException e) {
            return "[]".getBytes(StandardCharsets.UTF_8);
        }
    }

    private record StandardData(String standardRef, String name, List<ClauseData> clauses) {}
    private record ClauseData(String clauseNumber, String title, String content, List<CheckpointData> checkpoints) {}
    private record CheckpointData(String description, String severity, List<String> matchKeywords) {}

    @Override
    @Transactional
    public void updateResults(String reviewId, String userId,
                              ReviewResultsUpdateRequest body) {
        ReviewRecord record = reviewRecordMapper.selectById(reviewId);
        if (record == null || userId == null || !userId.equals(record.getUserId())) {
            throw new IllegalArgumentException("审查记录不存在");
        }
        if (!"pending".equals(record.getStatus()) && !"running".equals(record.getStatus())) {
            throw new IllegalStateException("当前状态不允许更新结果");
        }
        if (body.getIssues() != null) {
            for (var item : body.getIssues()) {
                ReviewIssue issue = new ReviewIssue();
                issue.setId(UUID.randomUUID().toString());
                issue.setRecordId(reviewId);
                issue.setSeverity(item.getSeverity());
                issue.setDimension(item.getDimension());
                issue.setTitle(item.getTitle());
                issue.setDescription(item.getDescription());
                issue.setOriginalSnippet(item.getOriginalSnippet());
                issue.setSnippetStart(item.getSnippetStart());
                issue.setChapterRef(item.getChapterRef());
                issue.setStandardRef(item.getStandardRef());
                issue.setStandardClause(item.getStandardClause());
                issue.setStandardText(item.getStandardText());
                issue.setSuggestionText(item.getSuggestionText());
                issue.setStatus("pending");
                issue.setCreatedAt(LocalDateTime.now());
                reviewIssueMapper.insert(issue);
            }
        }
        if (body.getSummary() != null) {
            record.setSummary(body.getSummary());
        }
        record.setStatus("completed");
        record.setUpdatedAt(LocalDateTime.now());
        reviewRecordMapper.updateById(record);
    }

    @Override
    public void updateClawithSession(String reviewId, String userId,
                                     ClawithSessionUpdateRequest body) {
        ReviewRecord record = reviewRecordMapper.selectById(reviewId);
        if (record == null || userId == null || !userId.equals(record.getUserId())) {
            throw new IllegalArgumentException("审查记录不存在");
        }
        if (record.getStatus() == null
                || (!"pending".equals(record.getStatus()) && !"running".equals(record.getStatus()))) {
            throw new IllegalStateException("当前状态不允许更新 session");
        }
        String existing = normalize(record.getClawithSessionId());
        if (!existing.isBlank()) {
            throw new IllegalStateException("clawith session 已绑定，不允许覆盖");
        }
        String newValue = normalize(body.getClawithSessionId());
        if (newValue.isBlank()) {
            throw new IllegalArgumentException("clawithSessionId 不能为空");
        }
        record.setClawithSessionId(newValue);
        record.setUpdatedAt(LocalDateTime.now());
        reviewRecordMapper.updateById(record);
    }

    @Override
    public ReviewSourceAccessResponse getSourceAccess(String reviewId, String userId) {
        ReviewRecord record = reviewRecordMapper.selectById(reviewId);
        if (record == null || userId == null || !userId.equals(record.getUserId())) {
            return null;
        }
        String ossFileKey = normalize(record.getOssFileKey());
        if (ossFileKey.isBlank()) {
            throw new IllegalStateException("审查记录缺少 ossFileKey，无法生成源文件访问地址");
        }

        String fileName = resolveFileName(record.getDocumentName(), ossFileKey);
        String contentType = resolveContentType(fileName);
        Instant expiresAt = Instant.now().plusSeconds(SOURCE_ACCESS_EXPIRE_SECONDS);

        ReviewSourceAccessResponse response = new ReviewSourceAccessResponse();
        response.setReviewId(record.getId());
        response.setDocumentName(record.getDocumentName());
        response.setOssFileKey(ossFileKey);
        response.setFileName(fileName);
        response.setContentType(contentType);
        response.setAccessUrl(createSignedReadUrl(ossFileKey));
        response.setExpiresAt(expiresAt);
        return response;
    }

    private String createSignedReadUrl(String ossFileKey) {
        String bucket = ossProperties.getBucket();
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalStateException("OSS bucket 未配置，无法生成源文件访问地址");
        }
        String accessKeyId = ossProperties.getAccessKeyId();
        String accessKeySecret = ossProperties.getAccessKeySecret();
        if (accessKeyId == null || accessKeyId.isBlank() || accessKeySecret == null || accessKeySecret.isBlank()) {
            throw new IllegalStateException("OSS 访问密钥未配置，无法生成源文件访问地址");
        }
        Date expiration = Date.from(Instant.now().plusSeconds(SOURCE_ACCESS_EXPIRE_SECONDS));
        ClientBuilderConfiguration clientConfiguration = new ClientBuilderConfiguration();
        clientConfiguration.setSignatureVersion(SignVersion.V4);
        SignedEndpoint signedEndpoint = resolveSignedReadEndpoint(bucket);
        clientConfiguration.setSupportCname(signedEndpoint.supportCname());
        OSS ossClient = OSSClientBuilder.create()
                .endpoint(signedEndpoint.endpoint())
                .credentialsProvider(new DefaultCredentialProvider(accessKeyId, accessKeySecret))
                .clientConfiguration(clientConfiguration)
                .region(resolveSigningRegion(signedEndpoint.endpoint()))
                .build();
        try {
            URL signedUrl = ossClient.generatePresignedUrl(bucket, ossFileKey, expiration);
            return signedUrl.toString();
        } finally {
            ossClient.shutdown();
        }
    }

    private SignedEndpoint resolveSignedReadEndpoint(String bucket) {
        String host = normalizeEndpoint(ossProperties.getHost());
        if (!host.isBlank()) {
            return classifySignedReadEndpoint(host, bucket);
        }
        String endpoint = normalizeEndpoint(ossProperties.getEndpoint());
        if (!endpoint.isBlank() && isOssServiceEndpoint(endpoint)) {
            return classifySignedReadEndpoint(endpoint, bucket);
        }
        return new SignedEndpoint(resolveOssEndpoint(), false);
    }

    private static boolean isCustomCnameHost(String host) {
        String normalizedHost = normalizeEndpoint(host);
        if (normalizedHost.isBlank()) {
            return false;
        }
        String parsedHost = URI.create(normalizedHost).getHost();
        if (parsedHost == null || parsedHost.isBlank()) {
            return false;
        }
        String lowerHost = parsedHost.toLowerCase(Locale.ROOT);
        return !lowerHost.endsWith(".aliyuncs.com") && !lowerHost.equals("aliyuncs.com");
    }

    private SignedEndpoint classifySignedReadEndpoint(String endpoint, String bucket) {
        String normalizedEndpoint = normalizeEndpoint(endpoint);
        if (normalizedEndpoint.isBlank()) {
            return new SignedEndpoint(resolveOssEndpoint(), false);
        }
        if (isCustomCnameHost(normalizedEndpoint)) {
            return new SignedEndpoint(normalizedEndpoint, true);
        }
        if (isAliyunBucketEndpoint(normalizedEndpoint, bucket)) {
            return new SignedEndpoint(toRegionalEndpoint(normalizedEndpoint, bucket), false);
        }
        return new SignedEndpoint(normalizedEndpoint, false);
    }

    private String resolveSigningRegion(String endpoint) {
        String region = normalize(ossProperties.getRegion());
        if (!region.isBlank()) {
            return region;
        }
        String normalizedEndpoint = normalizeEndpoint(endpoint);
        if (!normalizedEndpoint.isBlank()) {
            String host = URI.create(normalizedEndpoint).getHost();
            if (host != null) {
                String lowerHost = host.toLowerCase(Locale.ROOT);
                int marker = lowerHost.indexOf("oss-");
                int suffix = lowerHost.indexOf(".aliyuncs.com");
                if (marker >= 0 && suffix > marker + 4) {
                    return lowerHost.substring(marker + 4, suffix);
                }
            }
        }
        return "cn-guangzhou";
    }

    private String resolveOssEndpoint() {
        String endpoint = normalizeEndpoint(ossProperties.getEndpoint());
        if (!endpoint.isBlank() && isOssServiceEndpoint(endpoint)) {
            return endpoint;
        }
        return "https://oss-" + resolveSigningRegion(endpoint) + ".aliyuncs.com";
    }

    private static String normalizeEndpoint(String endpoint) {
        String normalized = normalize(endpoint);
        if (normalized.isBlank()) {
            return "";
        }
        if (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (!normalized.contains("://")) {
            normalized = "https://" + normalized;
        }
        return normalized;
    }

    private static boolean isOssServiceEndpoint(String endpoint) {
        String host = URI.create(normalizeEndpoint(endpoint)).getHost();
        if (host == null || host.isBlank()) {
            return false;
        }
        String lowerHost = host.toLowerCase(Locale.ROOT);
        return lowerHost.startsWith("oss-") || lowerHost.contains(".oss-");
    }

    private static boolean isAliyunBucketEndpoint(String endpoint, String bucket) {
        String host = URI.create(normalizeEndpoint(endpoint)).getHost();
        String normalizedBucket = normalize(bucket).toLowerCase(Locale.ROOT);
        if (host == null || host.isBlank() || normalizedBucket.isBlank()) {
            return false;
        }
        String lowerHost = host.toLowerCase(Locale.ROOT);
        return lowerHost.startsWith(normalizedBucket + ".") && lowerHost.contains(".oss-") && lowerHost.endsWith(".aliyuncs.com");
    }

    private static String toRegionalEndpoint(String endpoint, String bucket) {
        URI uri = URI.create(normalizeEndpoint(endpoint));
        String host = uri.getHost();
        String bucketPrefix = normalize(bucket).toLowerCase(Locale.ROOT) + ".";
        String regionalHost = host.substring(bucketPrefix.length());
        int port = uri.getPort();
        if (port > 0) {
            return uri.getScheme() + "://" + regionalHost + ":" + port;
        }
        return uri.getScheme() + "://" + regionalHost;
    }

    private OSS createOssClient() {
        String bucket = ossProperties.getBucket();
        String accessKeyId = ossProperties.getAccessKeyId();
        String accessKeySecret = ossProperties.getAccessKeySecret();
        if (accessKeyId == null || accessKeyId.isBlank()
                || accessKeySecret == null || accessKeySecret.isBlank()) {
            throw new IllegalStateException("OSS 访问密钥未配置");
        }
        ClientBuilderConfiguration clientConfig = new ClientBuilderConfiguration();
        clientConfig.setSignatureVersion(SignVersion.V4);
        SignedEndpoint signed = resolveSignedReadEndpoint(bucket);
        clientConfig.setSupportCname(signed.supportCname());
        return OSSClientBuilder.create()
                .endpoint(signed.endpoint())
                .credentialsProvider(new DefaultCredentialProvider(accessKeyId, accessKeySecret))
                .clientConfiguration(clientConfig)
                .region(resolveSigningRegion(signed.endpoint()))
                .build();
    }

    private List<String> parseJsonList(String json) {
        try {
            return objectMapper.readValue(
                    json != null && !json.isBlank() ? json : "[]",
                    new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String resolveFileName(String documentName, String ossFileKey) {
        String normalizedDocumentName = normalize(documentName);
        if (!normalizedDocumentName.isBlank()) {
            return normalizedDocumentName;
        }
        String normalizedKey = normalize(ossFileKey);
        int slashIndex = normalizedKey.lastIndexOf('/');
        return slashIndex >= 0 ? normalizedKey.substring(slashIndex + 1) : normalizedKey;
    }

    private static String resolveContentType(String fileName) {
        String lowerFileName = normalize(fileName).toLowerCase(Locale.ROOT);
        if (lowerFileName.endsWith(".md")) {
            return "text/markdown; charset=UTF-8";
        }
        if (lowerFileName.endsWith(".txt")) {
            return "text/plain; charset=UTF-8";
        }
        return "application/octet-stream";
    }

    private static String normalize(String value) {
        return value != null ? value.trim() : "";
    }

    private record SignedEndpoint(String endpoint, boolean supportCname) {
    }
}
