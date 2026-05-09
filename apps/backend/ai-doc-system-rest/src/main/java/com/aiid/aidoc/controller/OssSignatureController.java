package com.aiid.aidoc.controller;

import com.aiid.aidoc.config.OssProperties;
import com.aiid.aidoc.model.common.ApiResponse;
import com.aliyun.oss.common.utils.BinaryUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.binary.Base64;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/oss")
@RequiredArgsConstructor
public class OssSignatureController {

    private final OssProperties ossProperties;

    @GetMapping("/upload-signature")
    public ApiResponse<Map<String, String>> getUploadSignature() throws Exception {
        String accessKeyId = ossProperties.getAccessKeyId();
        String accessKeySecret = ossProperties.getAccessKeySecret();

        // 1. 计算 OSS V4 签名所需的日期
        ZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);
        String date = utcNow.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String xOssDate = utcNow.format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));

        // 2. 构建 x-oss-credential
        String xOssCredential = accessKeyId + "/" + date + "/" + ossProperties.getRegion() + "/oss/aliyun_v4_request";

        // 3. 构建 Policy
        ObjectMapper mapper = new ObjectMapper();
        Map<String, Object> policy = new LinkedHashMap<>();
        policy.put("expiration", generateExpiration(ossProperties.getExpireSeconds()));

        List<Object> conditions = new ArrayList<>();
        conditions.add(Map.of("bucket", ossProperties.getBucket()));
        conditions.add(Map.of("x-oss-signature-version", "OSS4-HMAC-SHA256"));
        conditions.add(Map.of("x-oss-credential", xOssCredential));
        conditions.add(Map.of("x-oss-date", xOssDate));
        conditions.add(Arrays.asList("content-length-range", 1, 1048576));
        conditions.add(Arrays.asList("eq", "$success_action_status", "200"));
        conditions.add(Arrays.asList("starts-with", "$key", ossProperties.getUploadDir()));

        policy.put("conditions", conditions);
        String jsonPolicy = mapper.writeValueAsString(policy);

        // 4. Base64 编码 Policy → StringToSign
        String stringToSign = Base64.encodeBase64String(jsonPolicy.getBytes());

        // 5. 计算 SigningKey (四级 HMAC-SHA256 密钥派生)
        byte[] dateKey = hmacSha256(("aliyun_v4" + accessKeySecret).getBytes(), date);
        byte[] dateRegionKey = hmacSha256(dateKey, ossProperties.getRegion());
        byte[] dateRegionServiceKey = hmacSha256(dateRegionKey, "oss");
        byte[] signingKey = hmacSha256(dateRegionServiceKey, "aliyun_v4_request");

        // 6. 计算 Signature
        byte[] signatureBytes = hmacSha256(signingKey, stringToSign);
        String signature = BinaryUtil.toHex(signatureBytes);

        // 7. 组装响应
        Map<String, String> result = new LinkedHashMap<>();
        result.put("version", "OSS4-HMAC-SHA256");
        result.put("policy", stringToSign);
        result.put("signature", signature);
        result.put("x_oss_credential", xOssCredential);
        result.put("x_oss_date", xOssDate);
        result.put("host", ossProperties.getHost());
        result.put("dir", ossProperties.getUploadDir());

        return ApiResponse.success(result);
    }

    private static String generateExpiration(long seconds) {
        long expirationTime = Instant.now().getEpochSecond() + seconds;
        Instant instant = Instant.ofEpochSecond(expirationTime);
        ZonedDateTime zdt = instant.atZone(ZoneOffset.UTC);
        return zdt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
    }

    private static byte[] hmacSha256(byte[] key, String data) {
        try {
            SecretKeySpec secretKeySpec = new SecretKeySpec(key, "HmacSHA256");
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(secretKeySpec);
            return mac.doFinal(data.getBytes());
        } catch (Exception e) {
            throw new RuntimeException("Failed to calculate HMAC-SHA256", e);
        }
    }
}
