package com.aiid.aidoc.service;

import com.aiid.aidoc.model.entity.Checkpoint;

import java.util.List;

public interface CheckpointService {
    List<Checkpoint> listByClause(String clauseId);
    Checkpoint create(Checkpoint checkpoint);
    Checkpoint update(String id, Checkpoint data);
    boolean delete(String id);
}
