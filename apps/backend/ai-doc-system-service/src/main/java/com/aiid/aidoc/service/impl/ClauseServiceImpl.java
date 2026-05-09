package com.aiid.aidoc.service.impl;

import com.aiid.aidoc.api.dto.StandardTreeResponse;
import com.aiid.aidoc.model.entity.Checkpoint;
import com.aiid.aidoc.model.entity.Clause;
import com.aiid.aidoc.repository.mapper.CheckpointMapper;
import com.aiid.aidoc.repository.mapper.ClauseMapper;
import com.aiid.aidoc.service.ClauseService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ClauseServiceImpl implements ClauseService {

    private final ClauseMapper clauseMapper;
    private final CheckpointMapper checkpointMapper;
    private final ObjectMapper objectMapper;

    @Override
    public List<StandardTreeResponse.ClauseTreeItem> listByStandard(String standardId) {
        List<Clause> clauses = clauseMapper.selectList(
                new LambdaQueryWrapper<Clause>()
                        .eq(Clause::getStandardId, standardId)
                        .orderByAsc(Clause::getClauseNumber)
        );
        List<StandardTreeResponse.ClauseTreeItem> items = new ArrayList<>();
        for (Clause cl : clauses) {
            List<Checkpoint> checkpoints = checkpointMapper.selectList(
                    new LambdaQueryWrapper<Checkpoint>().eq(Checkpoint::getClauseId, cl.getId())
            );
            StandardTreeResponse.ClauseTreeItem item = new StandardTreeResponse.ClauseTreeItem();
            item.setClause(cl);
            item.setCheckpoints(checkpoints);
            items.add(item);
        }
        return items;
    }

    @Override
    public Clause create(Clause clause) {
        clause.setId(UUID.randomUUID().toString());
        clause.setCreatedAt(LocalDateTime.now());
        clause.setUpdatedAt(LocalDateTime.now());
        clauseMapper.insert(clause);
        return clause;
    }

    @Override
    public Clause update(String id, Clause data) {
        Clause existing = clauseMapper.selectById(id);
        if (existing == null) return null;
        if (data.getClauseNumber() != null) existing.setClauseNumber(data.getClauseNumber());
        if (data.getTitle() != null) existing.setTitle(data.getTitle());
        if (data.getContent() != null) existing.setContent(data.getContent());
        if (data.getTags() != null) existing.setTags(data.getTags());
        existing.setUpdatedAt(LocalDateTime.now());
        clauseMapper.updateById(existing);
        return existing;
    }

    @Override
    @Transactional
    public boolean delete(String id) {
        Clause existing = clauseMapper.selectById(id);
        if (existing == null) return false;
        checkpointMapper.delete(
                new LambdaQueryWrapper<Checkpoint>().eq(Checkpoint::getClauseId, id)
        );
        clauseMapper.deleteById(id);
        return true;
    }
}
