package com.aiid.aidoc.service;

import com.aiid.aidoc.model.entity.User;

import java.util.Optional;

public interface UserService {
    User register(String email, String password, String nickname);
    Optional<User> login(String email, String password);
    Optional<User> findById(String id);
    User updateProfile(String userId, String nickname);
    void changePassword(String userId, String oldPassword, String newPassword);
}
