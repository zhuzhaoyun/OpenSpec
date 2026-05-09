package com.aiid.aidoc.service.impl;

import com.aiid.aidoc.api.dto.ReviewSourceAccessResponse;
import com.aiid.aidoc.config.AppProperties;
import com.aiid.aidoc.config.OssProperties;
import com.aiid.aidoc.model.entity.ReviewRecord;
import com.aiid.aidoc.repository.mapper.CheckpointMapper;
import com.aiid.aidoc.repository.mapper.ClauseMapper;
import com.aiid.aidoc.repository.mapper.ReviewIssueMapper;
import com.aiid.aidoc.repository.mapper.ReviewRecordMapper;
import com.aiid.aidoc.repository.mapper.StandardMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReviewServiceImplTest {

    @Mock
    private ReviewRecordMapper reviewRecordMapper;

    @Mock
    private ReviewIssueMapper reviewIssueMapper;

    @Mock
    private StandardMapper standardMapper;

    @Mock
    private ClauseMapper clauseMapper;

    @Mock
    private CheckpointMapper checkpointMapper;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void getSourceAccessNormalizesAliyunBucketEndpointAndUsesOss4Signing() {
        ReviewServiceImpl reviewService = new ReviewServiceImpl(
                reviewRecordMapper,
                reviewIssueMapper,
                standardMapper,
                clauseMapper,
                checkpointMapper,
                objectMapper,
                ossProperties("your-bucket", "cn-guangzhou",
                        "https://your-bucket.oss-cn-guangzhou.aliyuncs.com", null),
                new AppProperties()
        );

        when(reviewRecordMapper.selectById("review-1")).thenReturn(reviewRecord("review-1", "user-1"));

        ReviewSourceAccessResponse response = reviewService.getSourceAccess("review-1", "user-1");
        Map<String, String> query = parseQuery(URI.create(response.getAccessUrl()));

        assertEquals("your-bucket.oss-cn-guangzhou.aliyuncs.com", URI.create(response.getAccessUrl()).getHost());
        assertEquals("OSS4-HMAC-SHA256", query.get("x-oss-signature-version"));
        assertTrue(query.get("x-oss-credential").startsWith("ak/"));
        assertTrue(query.get("x-oss-credential").endsWith("/cn-guangzhou/oss/aliyun_v4_request"));
        assertTrue(query.containsKey("x-oss-signature"));
    }

    @Test
    void getSourceAccessUsesHostAsCustomCnameAndReturnsOffsetAwareExpiry() {
        ReviewServiceImpl reviewService = new ReviewServiceImpl(
                reviewRecordMapper,
                reviewIssueMapper,
                standardMapper,
                clauseMapper,
                checkpointMapper,
                objectMapper,
                ossProperties("your-bucket", "cn-guangzhou",
                        "sts.cn-guangzhou.aliyuncs.com", "https://files.example.com"),
                new AppProperties()
        );

        when(reviewRecordMapper.selectById("review-2")).thenReturn(reviewRecord("review-2", "user-1"));

        ReviewSourceAccessResponse response = reviewService.getSourceAccess("review-2", "user-1");
        Map<String, String> query = parseQuery(URI.create(response.getAccessUrl()));
        Object expiresAt = response.getExpiresAt();

        assertEquals("files.example.com", URI.create(response.getAccessUrl()).getHost());
        assertEquals("OSS4-HMAC-SHA256", query.get("x-oss-signature-version"));
        assertNotNull(expiresAt);
        assertTrue(!(expiresAt instanceof LocalDateTime));
        assertTrue(String.valueOf(expiresAt).matches(".+(Z|[+-][0-9]{2}:[0-9]{2})$"));
    }

    private static ReviewRecord reviewRecord(String reviewId, String userId) {
        ReviewRecord record = new ReviewRecord();
        record.setId(reviewId);
        record.setUserId(userId);
        record.setDocumentName("spec.md");
        record.setOssFileKey("docs/spec.md");
        return record;
    }

    private static OssProperties ossProperties(String bucket, String region, String endpoint, String host) {
        OssProperties ossProperties = new OssProperties();
        ossProperties.setBucket(bucket);
        ossProperties.setRegion(region);
        ossProperties.setEndpoint(endpoint);
        ossProperties.setHost(host);
        ossProperties.setAccessKeyId("ak");
        ossProperties.setAccessKeySecret("sk");
        return ossProperties;
    }

    private static Map<String, String> parseQuery(URI uri) {
        Map<String, String> query = new LinkedHashMap<>();
        String rawQuery = uri.getRawQuery();
        if (rawQuery == null || rawQuery.isBlank()) {
            return query;
        }
        Arrays.stream(rawQuery.split("&"))
                .map(part -> part.split("=", 2))
                .forEach(part -> query.put(
                        URLDecoder.decode(part[0], StandardCharsets.UTF_8),
                        part.length > 1 ? URLDecoder.decode(part[1], StandardCharsets.UTF_8) : ""
                ));
        return query;
    }
}
