package com.aiid.aidoc.controller;

import com.aiid.aidoc.api.dto.ClauseCreateRequest;
import com.aiid.aidoc.api.dto.CheckpointRequest;
import com.aiid.aidoc.api.dto.PaginationResponse;
import com.aiid.aidoc.api.dto.StandardCreateRequest;
import com.aiid.aidoc.api.dto.StandardTreeResponse;
import com.aiid.aidoc.model.common.ApiResponse;
import com.aiid.aidoc.model.entity.Checkpoint;
import com.aiid.aidoc.model.entity.Clause;
import com.aiid.aidoc.model.entity.Standard;
import com.aiid.aidoc.service.CheckpointService;
import com.aiid.aidoc.service.ClauseService;
import com.aiid.aidoc.service.StandardService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class StandardClauseController {

    private final StandardService standardService;
    private final ClauseService clauseService;
    private final CheckpointService checkpointService;
    private final ObjectMapper objectMapper;

    // ==================== Standard CRUD ====================

    @GetMapping("/standards")
    public ApiResponse<PaginationResponse<Standard>> listStandards(
            @RequestParam(required = false) String profession,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "20") long pageSize
    ) {
        Page<Standard> p = standardService.list(profession, keyword, page, pageSize);
        PaginationResponse<Standard> resp = new PaginationResponse<>();
        resp.setTotal(p.getTotal());
        resp.setPage(p.getCurrent());
        resp.setPageSize(p.getSize());
        resp.setList(p.getRecords() != null ? p.getRecords() : List.of());
        return ApiResponse.success(resp);
    }

    @GetMapping("/standards/tree")
    public ApiResponse<List<StandardTreeResponse>> getStandardTree() {
        return ApiResponse.success(standardService.getTree());
    }

    @PostMapping("/standards")
    public ApiResponse<Standard> createStandard(
            @RequestBody StandardCreateRequest body,
            HttpServletRequest request
    ) {
        String userId = (String) request.getAttribute("userId");
        Standard standard = new Standard();
        standard.setNumber(body.getNumber());
        standard.setName(body.getName());
        standard.setProfession(body.getProfession());
        standard.setStatus(body.getStatus() != null ? body.getStatus() : "active");
        standard.setSupersededBy(body.getSupersededBy());
        standard.setDescription(body.getDescription());
        standard.setUserId(userId);
        return ApiResponse.created(standardService.create(standard));
    }

    @PutMapping("/standards/{id}")
    public ApiResponse<Standard> updateStandard(
            @PathVariable String id,
            @RequestBody StandardCreateRequest body
    ) {
        Standard data = new Standard();
        data.setNumber(body.getNumber());
        data.setName(body.getName());
        data.setProfession(body.getProfession());
        data.setStatus(body.getStatus());
        data.setSupersededBy(body.getSupersededBy());
        data.setDescription(body.getDescription());
        Standard updated = standardService.update(id, data);
        if (updated == null) {
            return ApiResponse.message(404, "标准不存在");
        }
        return ApiResponse.success(updated);
    }

    @DeleteMapping("/standards/{id}")
    public ApiResponse<Void> deleteStandard(@PathVariable String id) {
        boolean ok = standardService.delete(id);
        if (!ok) {
            return ApiResponse.message(404, "标准不存在");
        }
        return ApiResponse.message(200, "已删除");
    }

    // ==================== Clause CRUD ====================

    @GetMapping("/clauses")
    public ApiResponse<List<StandardTreeResponse.ClauseTreeItem>> listClauses(
            @RequestParam String standardId
    ) {
        return ApiResponse.success(clauseService.listByStandard(standardId));
    }

    @PostMapping("/clauses")
    public ApiResponse<Clause> createClause(@RequestBody ClauseCreateRequest body) {
        Clause clause = new Clause();
        clause.setStandardId(body.getStandardId());
        clause.setClauseNumber(body.getClauseNumber());
        clause.setTitle(body.getTitle());
        clause.setContent(body.getContent());
        try {
            clause.setTags(objectMapper.writeValueAsString(
                    body.getTags() != null ? body.getTags() : List.of()));
        } catch (JsonProcessingException e) {
            clause.setTags("[]");
        }
        return ApiResponse.created(clauseService.create(clause));
    }

    @PutMapping("/clauses/{id}")
    public ApiResponse<Clause> updateClause(
            @PathVariable String id,
            @RequestBody ClauseCreateRequest body
    ) {
        Clause data = new Clause();
        data.setClauseNumber(body.getClauseNumber());
        data.setTitle(body.getTitle());
        data.setContent(body.getContent());
        try {
            data.setTags(objectMapper.writeValueAsString(
                    body.getTags() != null ? body.getTags() : List.of()));
        } catch (JsonProcessingException e) {
            data.setTags("[]");
        }
        Clause updated = clauseService.update(id, data);
        if (updated == null) {
            return ApiResponse.message(404, "条文不存在");
        }
        return ApiResponse.success(updated);
    }

    @DeleteMapping("/clauses/{id}")
    public ApiResponse<Void> deleteClause(@PathVariable String id) {
        boolean ok = clauseService.delete(id);
        if (!ok) {
            return ApiResponse.message(404, "条文不存在");
        }
        return ApiResponse.message(200, "已删除");
    }

    // ==================== Checkpoint CRUD ====================

    @GetMapping("/checkpoints")
    public ApiResponse<List<Checkpoint>> listCheckpoints(
            @RequestParam String clauseId
    ) {
        return ApiResponse.success(checkpointService.listByClause(clauseId));
    }

    @PostMapping("/checkpoints")
    public ApiResponse<Checkpoint> createCheckpoint(@RequestBody CheckpointRequest body) {
        Checkpoint cp = new Checkpoint();
        cp.setClauseId(body.getClauseId());
        cp.setDescription(body.getDescription());
        cp.setSeverity(body.getSeverity());
        try {
            cp.setMatchKeywords(objectMapper.writeValueAsString(
                    body.getMatchKeywords() != null ? body.getMatchKeywords() : List.of()));
        } catch (JsonProcessingException e) {
            cp.setMatchKeywords("[]");
        }
        return ApiResponse.created(checkpointService.create(cp));
    }

    @PutMapping("/checkpoints/{id}")
    public ApiResponse<Checkpoint> updateCheckpoint(
            @PathVariable String id,
            @RequestBody CheckpointRequest body
    ) {
        Checkpoint data = new Checkpoint();
        data.setDescription(body.getDescription());
        data.setSeverity(body.getSeverity());
        try {
            data.setMatchKeywords(objectMapper.writeValueAsString(
                    body.getMatchKeywords() != null ? body.getMatchKeywords() : List.of()));
        } catch (JsonProcessingException e) {
            data.setMatchKeywords("[]");
        }
        Checkpoint updated = checkpointService.update(id, data);
        if (updated == null) {
            return ApiResponse.message(404, "检查点不存在");
        }
        return ApiResponse.success(updated);
    }

    @DeleteMapping("/checkpoints/{id}")
    public ApiResponse<Void> deleteCheckpoint(@PathVariable String id) {
        boolean ok = checkpointService.delete(id);
        if (!ok) {
            return ApiResponse.message(404, "检查点不存在");
        }
        return ApiResponse.message(200, "已删除");
    }
}
