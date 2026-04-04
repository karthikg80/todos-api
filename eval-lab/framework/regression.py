"""Regression suite support.

Manages a separate set of cases that track specific bugs/failures.
Regression cases are distinct from benchmark/dev/test cases — they are
added whenever a new failure mode is discovered and fixed.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from framework.schemas import Case, CaseMetadata


class RegressionSuite:
    """Manages regression test cases.

    Regression cases are stored separately from benchmark cases.
    They track specific bugs/failures that should not recur.
    """

    def __init__(self, regression_dir: Path):
        self.REGRESSION_DIR = regression_dir
        self.REGRESSION_DIR.mkdir(parents=True, exist_ok=True)
        self._cases: list[Case] | None = None

    def load_cases(self) -> list[Case]:
        """Load all regression cases."""
        if self._cases is not None:
            return list(self._cases)

        cases = []
        for case_file in sorted(self.REGRESSION_DIR.glob("regression-*.json")):
            with open(case_file) as f:
                data = json.load(f)
            cases.append(Case(**data))

        self._cases = cases
        return cases

    def add_regression_case(
        self,
        case_id: str,
        input_data: dict[str, Any],
        expected_data: dict[str, Any],
        bug_description: str,
        fix_description: str,
        slices: list[str] | None = None,
        source: str = "production_derived",
    ) -> Case:
        """Add a new regression case.

        Args:
            case_id: Unique identifier (e.g. "reg-001")
            input_data: Case input
            expected_data: Expected output
            bug_description: What bug this case covers
            fix_description: How the bug was fixed
            slices: Slice labels for this case
            source: Provenance source
        """
        metadata = CaseMetadata(
            source=source,
            created_at=datetime.now(timezone.utc).isoformat(),
            slices=slices or [],
            why_this_case=f"Regression for bug: {bug_description}",
            what_good_looks_like=fix_description,
            regression_for_bug=bug_description,
        )

        case = Case(
            id=case_id,
            input=input_data,
            expected=expected_data,
            metadata=metadata,
            split="regression",
        )

        # Save to disk
        case_file = self.REGRESSION_DIR / f"{case_id}.json"
        with open(case_file, "w") as f:
            json.dump(case.model_dump(), f, indent=2)

        # Invalidate cache
        self._cases = None
        return case

    def list_regressions(self) -> list[dict[str, str]]:
        """List all regression cases with their bug descriptions."""
        cases = self.load_cases()
        return [
            {
                "id": c.id,
                "bug": c.metadata.regression_for_bug,
                "slices": c.metadata.slices,
                "created_at": c.metadata.created_at,
            }
            for c in cases
        ]
