package com.jimmyaviation.website.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.AdminUser;

public interface AdminUserRepository extends JpaRepository<AdminUser, Integer> {
    Optional<AdminUser> findByUsername(String username);
}
