package com.aiid.aidoc.service.impl;

import com.aiid.aidoc.model.entity.Checkpoint;
import com.aiid.aidoc.repository.mapper.CheckpointMapper;
import com.aiid.aidoc.service.CheckpointService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CheckpointServiceImpl implements CheckpointService {

    private final CheckpointMapper checkpointMapper;

    @Override
    public List<Checkpoint> listByClause(String clauseId) {
        return checkpointMapper.selectList(
                new LambdaQueryWrapper<Checkpoint>()
                        .eq(Checkpoint::getClauseId, clauseId)
                        .orderByAsc(Checkpoint::getCreatedAt)
        );
    }

    @Override
    public Checkpoint create(Checkpoint checkpoint) {
        checkpoint.setId(UUID.randomUUID().toString());
        checkpoint.setCreatedAt(LocalDateTime.now());
        checkpoint.setUpdatedAt(LocalDateTime.now());
        checkpointMapper.insert(checkpoint);
        return checkpoint;
    }

    @Override
    public Checkpoint update(String id, Checkpoint data) {
        Checkpoint existing = checkpointMapper.selectById(id);
        if (existing == null) return null;
        if (data.getDescription() != null) existing.setDescription(data.getDescription());
        if (data.getSeverity() != null) existing.setSeverity(data.getSeverity());
        if (data.getMatchKeywords() != null) existing.setMatchKeywords(data.getMatchKeywords());
        existing.setUpdatedAt(LocalDateTime.now());
        checkpointMapper.updateById(existing);
        return existing;
    }

    @Override
    public boolean delete(String id) {
        Checkpoint existing = checkpointMapper.selectById(id);
        if (existing == null) return false;
        checkpointMapper.deleteById(id);
        return true;
    }
}
