package com.aiid.aidoc.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @NotBlank(message = "昵称不能为空")
    @Size(min = 1, max = 100, message = "昵称长度为1-100个字符")
    private String nickname;
}
