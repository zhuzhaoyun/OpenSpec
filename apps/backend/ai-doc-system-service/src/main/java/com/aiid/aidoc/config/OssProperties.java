package com.aiid.aidoc.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "oss")
public class OssProperties {
    private String bucket;
    private String region = "cn-guangzhou";
    private String endpoint = "sts.cn-guangzhou.aliyuncs.com";
    private String host;
    private String uploadDir = "reviews/";
    private long expireSeconds = 3600L;
    private String stsRoleArn;
    private String accessKeyId;
    private String accessKeySecret;
}
