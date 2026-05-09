package com.aiid.aidoc.service.impl;

import com.aiid.aidoc.model.entity.User;
import com.aiid.aidoc.repository.mapper.UserMapper;
import com.aiid.aidoc.service.UserService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private final UserMapper userMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public User register(String email, String password, String nickname) {
        // 检查邮箱是否已注册
        LambdaQueryWrapper<User> qw = new LambdaQueryWrapper<>();
        qw.eq(User::getEmail, email);
        if (userMapper.selectCount(qw) > 0) {
            throw new IllegalArgumentException("该邮箱已注册");
        }

        User user = new User();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setNickname(nickname != null ? nickname : email.split("@")[0]);
        user.setIsActive(true);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);
        return user;
    }

    @Override
    public Optional<User> login(String email, String password) {
        LambdaQueryWrapper<User> qw = new LambdaQueryWrapper<>();
        qw.eq(User::getEmail, email);
        qw.eq(User::getIsActive, true);
        User user = userMapper.selectOne(qw);
        if (user == null || !passwordEncoder.matches(password, user.getPassword())) {
            return Optional.empty();
        }
        return Optional.of(user);
    }

    @Override
    public Optional<User> findById(String id) {
        return Optional.ofNullable(userMapper.selectById(id));
    }

    @Override
    public User updateProfile(String userId, String nickname) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }
        user.setNickname(nickname);
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
        return user;
    }

    @Override
    public void changePassword(String userId, String oldPassword, String newPassword) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }
        // 演示账号不允许修改密码
        if ("test@qq.com".equals(user.getEmail())) {
            throw new IllegalArgumentException("演示账号不支持修改密码");
        }
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new IllegalArgumentException("当前密码错误");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
    }
}
