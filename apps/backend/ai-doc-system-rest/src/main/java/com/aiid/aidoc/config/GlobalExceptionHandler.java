package com.aiid.aidoc.config;

import com.aiid.aidoc.license.LicenseException;
import com.aiid.aidoc.model.common.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(LicenseException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> handleLicenseException(LicenseException e) {
        log.warn("授权校验失败: {}", e.getMessage());
        return ApiResponse.message(403, "功能未授权: " + e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getDefaultMessage())
                .findFirst()
                .orElse("参数校验失败");
        return ApiResponse.message(400, message);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleJsonParseException(HttpMessageNotReadableException e) {
        String msg = e.getMessage();
        if (msg != null && msg.length() > 200) {
            msg = msg.substring(0, 200);
        }
        log.warn("JSON 解析失败: {}", msg);
        return ApiResponse.message(400, "请求体格式错误: " + (msg != null ? msg : "无法解析请求体"));
    }
}
