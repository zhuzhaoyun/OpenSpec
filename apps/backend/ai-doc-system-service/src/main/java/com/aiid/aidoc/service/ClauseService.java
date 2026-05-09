package com.aiid.aidoc.service;

import com.aiid.aidoc.api.dto.StandardTreeResponse;
import com.aiid.aidoc.model.entity.Clause;

import java.util.List;

public interface ClauseService {
    List<StandardTreeResponse.ClauseTreeItem> listByStandard(String standardId);
    Clause create(Clause clause);
    Clause update(String id, Clause data);
    boolean delete(String id);
}
