package com.aiid.aidoc.controller;

import com.aiid.aidoc.api.dto.ChangePasswordRequest;
import com.aiid.aidoc.api.dto.LoginRequest;
import com.aiid.aidoc.api.dto.LoginResponse;
import com.aiid.aidoc.api.dto.RegisterRequest;
import com.aiid.aidoc.api.dto.UpdateProfileRequest;
import com.aiid.aidoc.config.JwtUtil;
import com.aiid.aidoc.model.common.ApiResponse;
import com.aiid.aidoc.model.entity.User;
import com.aiid.aidoc.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final JwtUtil jwtUtil;

    @PostMapping("/register")
    public ApiResponse<LoginResponse> register(@Valid @RequestBody RegisterRequest req) {
        try {
            User user = userService.register(req.getEmail(), req.getPassword(), req.getNickname());
            String token = jwtUtil.generateToken(user.getId(), user.getEmail());
            return ApiResponse.success(toLoginResponse(user, token));
        } catch (IllegalArgumentException e) {
            return ApiResponse.message(400, e.getMessage());
        }
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        return userService.login(req.getEmail(), req.getPassword())
                .map(user -> {
                    String token = jwtUtil.generateToken(user.getId(), user.getEmail());
                    LoginResponse resp = toLoginResponse(user, token);
                    return ApiResponse.success(resp);
                })
                .orElse(ApiResponse.message(401, "邮箱或密码错误"));
    }

    @GetMapping("/info")
    public ApiResponse<LoginResponse> info(HttpServletRequest request) {
        String userId = (String) request.getAttribute("userId");
        return userService.findById(userId)
                .map(user -> ApiResponse.success(toLoginResponse(user, null)))
                .orElse(ApiResponse.message(404, "用户不存在"));
    }

    @PutMapping("/profile")
    public ApiResponse<LoginResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest req,
                                                     HttpServletRequest request) {
        String userId = (String) request.getAttribute("userId");
        try {
            User user = userService.updateProfile(userId, req.getNickname());
            return ApiResponse.success(toLoginResponse(user, null));
        } catch (IllegalArgumentException e) {
            return ApiResponse.message(400, e.getMessage());
        }
    }

    @PutMapping("/password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest req,
                                             HttpServletRequest request) {
        String userId = (String) request.getAttribute("userId");
        try {
            userService.changePassword(userId, req.getOldPassword(), req.getNewPassword());
            return ApiResponse.success(null);
        } catch (IllegalArgumentException e) {
            return ApiResponse.message(400, e.getMessage());
        }
    }

    private LoginResponse toLoginResponse(User user, String token) {
        LoginResponse resp = new LoginResponse();
        resp.setId(user.getId());
        resp.setEmail(user.getEmail());
        resp.setNickname(user.getNickname());
        resp.setAvatar(user.getAvatar());
        resp.setAccessToken(token);
        return resp;
    }
}
