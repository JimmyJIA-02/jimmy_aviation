package com.jimmyaviation.website.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.jimmyaviation.website.config.JwtUtil;
import com.jimmyaviation.website.entity.AdminUser;
import com.jimmyaviation.website.repository.AdminUserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {
    
    private final AdminUserRepository adminUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

   public String login(String username, String password) {
        AdminUser admin = adminUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Invalid username or password"));

        if (!passwordEncoder.matches(password, admin.getPasswordHash())) {
            throw new RuntimeException("Invalid username or password");
        }

        return jwtUtil.generateToken(admin.getUsername());
    }

    // TODO: Add method to create admin users (for testing purposes, should be removed in production)
    public AdminUser createAdmin(String username, String password) {
        AdminUser user = new AdminUser();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        return adminUserRepository.save(user);
    }
}
