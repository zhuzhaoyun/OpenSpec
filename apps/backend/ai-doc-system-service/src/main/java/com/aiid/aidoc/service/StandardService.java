package com.aiid.aidoc.service;

import com.aiid.aidoc.api.dto.StandardTreeResponse;
import com.aiid.aidoc.model.entity.Standard;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

public interface StandardService {
    Page<Standard> list(String profession, String keyword, long page, long pageSize);
    List<StandardTreeResponse> getTree();
    Standard create(Standard standard);
    Standard update(String id, Standard data);
    boolean delete(String id);
}
