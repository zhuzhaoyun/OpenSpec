package com.aiid.aidoc.api.dto;

import com.aiid.aidoc.model.entity.Checkpoint;
import com.aiid.aidoc.model.entity.Clause;
import com.aiid.aidoc.model.entity.Standard;
import lombok.Data;

import java.util.List;

@Data
public class StandardTreeResponse {
    private Standard standard;
    private List<ClauseTreeItem> clauses;

    @Data
    public static class ClauseTreeItem {
        private Clause clause;
        private List<Checkpoint> checkpoints;
    }
}
