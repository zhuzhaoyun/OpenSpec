package com.aiid.aidoc.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter implements Filter {

    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        String path = req.getRequestURI();

        // 白名单路径不需要验证
        if (isPublicPath(path)) {
            chain.doFilter(request, response);
            return;
        }

        String authHeader = req.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            sendUnauthorized(res, "缺少认证信息");
            return;
        }

        String token = authHeader.substring(7);
        Claims claims;
        try {
            claims = jwtUtil.parseToken(token);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("JWT 验证失败: {}", e.getMessage());
            sendUnauthorized(res, "认证信息无效或已过期");
            return;
        }

        req.setAttribute("userId", claims.getSubject());
        req.setAttribute("email", claims.get("email", String.class));
        chain.doFilter(request, response);
    }

    private boolean isPublicPath(String path) {
        return path.endsWith("/user/login")
                || path.endsWith("/user/register")
                || path.contains("/templates/example/")
                || path.contains("/actuator")
                || path.contains("/reviews/") && (path.contains("/manifest") || path.contains("/source-file") || path.contains("/standards-file"));
    }

    private void sendUnauthorized(HttpServletResponse res, String message) throws IOException {
        res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write(objectMapper.writeValueAsString(
                Map.of("code", 401, "message", message)
        ));
    }
}
