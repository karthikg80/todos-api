"""Cross-family policy test runner.

Exercises multiple families together on a single user context to test
whether the pieces work well as a system, not just in isolation.

Flow:
1. Classify user maturity (feature_exposure)
2. Choose feature exposure policy (feature_exposure)
3. Choose planning mode (feature_exposure)
4. Prioritize tasks (prioritization)
5. Produce a plan (plan_from_goal)

This tests cross-family consistency and routing correctness.
"""
from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()

from portfolio import load_family


# ── Cross-Family Policy Test Case ────────────────────────────────────────────

@dataclass
class CrossFamilyTestCase:
    """A test case that exercises multiple families together."""
    case_id: str
    user_context: dict[str, Any]
    task_list: list[dict[str, Any]]
    goal: Optional[str] = None
    expected_segment: str = "unknown"
    expected_planning_mode: str = "unknown"
    expected_priority_order: list[str] = field(default_factory=list)
    expected_plan_steps: list[str] = field(default_factory=list)
    notes: str = ""


# ── Cross-Family Policy Test Runner ──────────────────────────────────────────

class CrossFamilyPolicyRunner:
    """Runs cross-family policy tests on a single user context."""
    
    def __init__(self):
        self.families = {}
    
    def _load_family(self, name: str):
        """Load a benchmark family."""
        if name not in self.families:
            family_cls = load_family(name)
            self.families[name] = family_cls()
        return self.families[name]
    
    async def run_cross_family_test(self, test_case: CrossFamilyTestCase) -> dict[str, Any]:
        """Run a cross-family policy test.
        
        Flow:
        1. Classify user maturity (feature_exposure)
        2. Choose feature exposure policy (feature_exposure)
        3. Choose planning mode (feature_exposure)
        4. Prioritize tasks (prioritization)
        5. Produce a plan (plan_from_goal)
        """
        results = {}
        
        # Step 1-3: Feature exposure classification and policy
        feature_exposure = self._load_family("feature_exposure")
        fe_input = {
            "user_context": {
                **test_case.user_context,
                "_expected_segment_for_false_conservatism": test_case.expected_segment,
            },
            "feature_catalog": {
                "core": ["quick_add", "task_list", "basic_search", "due_dates"],
                "intermediate": ["recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities"],
                "advanced": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
                "power": ["agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            },
        }
        fe_case = type('Case', (), {
            'id': test_case.case_id,
            'input': fe_input,
            'expected': {'expected_user_segment': test_case.expected_segment},
            'metadata': type('Meta', (), {'slices': ['cross-family'], 'difficulty': type('Diff', (), {'value': 'medium'})()}),
            'split': 'dev',
        })()
        
        fe_output = await feature_exposure.run_case(fe_case)
        fe_result = feature_exposure.grade_case(fe_case, fe_output)
        results["feature_exposure"] = {
            "output": fe_output,
            "result": {
                "score": fe_result.score,
                "dimensions": fe_result.breakdown.dimensions,
                "actual_segment": fe_output.get("user_segment", "unknown") if fe_output else "unknown",
                "confidence": fe_output.get("confidence", 0) if fe_output else 0,
            },
        }
        
        # Step 4: Prioritize tasks
        if test_case.task_list:
            prioritization = self._load_family("prioritization")
            prio_input = {
                "tasks": test_case.task_list,
                "user_context": test_case.user_context,
            }
            prio_case = type('Case', (), {
                'id': f"{test_case.case_id}-prio",
                'input': prio_input,
                'expected': {'expected_order': test_case.expected_priority_order},
                'metadata': type('Meta', (), {'slices': ['cross-family'], 'difficulty': type('Diff', (), {'value': 'medium'})()}),
                'split': 'dev',
            })()
            
            prio_output = await prioritization.run_case(prio_case)
            prio_result = prioritization.grade_case(prio_case, prio_output)
            results["prioritization"] = {
                "output": prio_output,
                "result": {
                    "score": prio_result.score,
                    "dimensions": prio_result.breakdown.dimensions,
                },
            }
        
        # Step 5: Produce a plan
        if test_case.goal:
            plan_from_goal = self._load_family("plan_from_goal")
            plan_input = {
                "goal": test_case.goal,
                "user_context": test_case.user_context,
                "available_tasks": test_case.task_list,
            }
            plan_case = type('Case', (), {
                'id': f"{test_case.case_id}-plan",
                'input': plan_input,
                'expected': {'expected_steps': test_case.expected_plan_steps},
                'metadata': type('Meta', (), {'slices': ['cross-family'], 'difficulty': type('Diff', (), {'value': 'medium'})()}),
                'split': 'dev',
            })()
            
            plan_output = await plan_from_goal.run_case(plan_case)
            plan_result = plan_from_goal.grade_case(plan_case, plan_output)
            results["plan_from_goal"] = {
                "output": plan_output,
                "result": {
                    "score": plan_result.score,
                    "dimensions": plan_result.breakdown.dimensions,
                },
            }
        
        # Cross-family consistency checks
        consistency = self._check_consistency(test_case, results)
        results["consistency"] = consistency
        
        return results
    
    def _check_consistency(self, test_case: CrossFamilyTestCase, results: dict) -> dict[str, Any]:
        """Check cross-family consistency.
        
        Rules:
        - Beginner users should not get advanced planning modes
        - Power users should not get basic planning modes
        - Feature exposure should match planning mode
        - Prioritization should respect user maturity level
        """
        issues = []
        
        fe_result = results.get("feature_exposure", {}).get("result", {})
        actual_segment = fe_result.get("actual_segment", "unknown")
        confidence = fe_result.get("confidence", 0)
        
        # Check segment vs planning mode consistency
        if "plan_from_goal" in results:
            plan_output = results["plan_from_goal"].get("output")
            if plan_output:
                plan_mode = plan_output.get("planning_mode", "unknown")

                if actual_segment == "beginner" and plan_mode in ("automation_bulk", "agentic"):
                    issues.append(f"Beginner user routed to {plan_mode} planning mode")
                elif actual_segment == "power" and plan_mode in ("lightweight_daily",):
                    issues.append(f"Power user routed to {plan_mode} planning mode")
        
        # Check confidence vs segment accuracy
        expected_segment = test_case.expected_segment
        if actual_segment != expected_segment and confidence > 0.8:
            issues.append(f"High confidence ({confidence:.2f}) but wrong segment (expected {expected_segment}, got {actual_segment})")
        
        # Check feature exposure vs planning mode
        if "feature_exposure" in results and "plan_from_goal" in results:
            enabled_features = fe_result.get("output", {}).get("enabled_features", [])
            plan_output = results["plan_from_goal"].get("output")
            if plan_output:
                plan_steps = plan_output.get("steps", [])

                # If advanced features are hidden, plan should not use them
                advanced_features = ["dependencies", "goals", "automation_rules", "bulk_edits"]
                hidden_features = fe_result.get("output", {}).get("hidden_features", [])
                if any(f in hidden_features for f in advanced_features):
                    # Check if plan uses advanced features
                    plan_text = json.dumps(plan_steps).lower()
                    if any(f in plan_text for f in advanced_features):
                        issues.append("Plan uses advanced features that are hidden from user")
        
        return {
            "issues": issues,
            "consistent": len(issues) == 0,
            "actual_segment": actual_segment,
            "expected_segment": test_case.expected_segment,
            "confidence": confidence,
            "downstream_impact": self._measure_downstream_impact(test_case, results),
        }
    
    def _measure_downstream_impact(self, test_case: CrossFamilyTestCase, results: dict) -> dict[str, Any]:
        """Measure downstream impact of misclassification.
        
        Instead of just checking classification accuracy, measure:
        - Did wrong classification cause wrong feature exposure?
        - Did that cause wrong planning mode?
        - Did that degrade plan quality?
        
        This turns the system into a true policy optimizer, not just a classifier evaluator.
        
        Now with DIRECTIONAL impact:
        - upward_risk: over-exposure danger (beginner→intermediate, advanced→power)
        - downward_loss: missed capability (power→advanced, intermediate→beginner)
        """
        fe_result = results.get("feature_exposure", {}).get("result", {})
        actual_segment = fe_result.get("actual_segment", "unknown")
        expected_segment = test_case.expected_segment
        
        impacts = []
        severity = "none"
        direction = "none"  # upward_risk, downward_loss, none
        
        # Determine direction of error
        segment_order = ["beginner", "intermediate", "advanced", "power"]
        if actual_segment != expected_segment:
            try:
                expected_idx = segment_order.index(expected_segment)
                actual_idx = segment_order.index(actual_segment)
                if actual_idx > expected_idx:
                    direction = "upward_risk"
                else:
                    direction = "downward_loss"
            except ValueError:
                direction = "unknown"
        
        # Check if misclassification caused feature exposure errors
        if actual_segment != expected_segment:
            fe_output = results.get("feature_exposure", {}).get("output")
            if fe_output:
                enabled_features = set(fe_output.get("enabled_features", []))
                expected_enabled = set(test_case.user_context.get("expected_enabled_features", []))
                
                # Check for over-exposure (enabled features that should be hidden)
                advanced_features = {"dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"}
                intermediate_features = {"recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities"}
                
                if expected_segment == "beginner" and actual_segment in ("intermediate", "advanced", "power"):
                    over_exposed = enabled_features & (intermediate_features | advanced_features)
                    if over_exposed:
                        impacts.append(f"Beginner exposed to {len(over_exposed)} advanced features: {list(over_exposed)[:3]}")
                        severity = "high" if actual_segment == "power" else "medium"
                
                elif expected_segment == "intermediate" and actual_segment in ("advanced", "power"):
                    over_exposed = enabled_features & advanced_features
                    if over_exposed:
                        impacts.append(f"Intermediate exposed to {len(over_exposed)} advanced features: {list(over_exposed)[:3]}")
                        severity = "high" if actual_segment == "power" else "medium"
                
                elif expected_segment == "advanced" and actual_segment == "power":
                    # Advanced→power is less severe but still risky
                    power_features = {"agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"}
                    over_exposed = enabled_features & power_features
                    if over_exposed:
                        impacts.append(f"Advanced exposed to {len(over_exposed)} power features: {list(over_exposed)[:3]}")
                        severity = "medium"
        
        # Check if wrong segment caused planning mode errors
        if "plan_from_goal" in results:
            plan_output = results["plan_from_goal"].get("output")
            if plan_output:
                plan_mode = plan_output.get("planning_mode", "unknown")
                expected_mode = test_case.expected_planning_mode
                
                if plan_mode != expected_mode:
                    impacts.append(f"Wrong planning mode: expected {expected_mode}, got {plan_mode}")
                    if severity == "none":
                        severity = "low"
        
        # Check if plan quality degraded due to misclassification
        if "plan_from_goal" in results:
            plan_result = results["plan_from_goal"].get("result", {})
            plan_score = plan_result.get("score", 0)
            
            if plan_score and plan_score < 0.5 and actual_segment != expected_segment:
                impacts.append(f"Plan quality degraded (score={plan_score:.2f}) due to misclassification")
                if severity in ("none", "low"):
                    severity = "medium"
        
        # Add directional qualifier to severity
        if direction == "upward_risk":
            directional_severity = f"{severity}_upward_risk"
        elif direction == "downward_loss":
            directional_severity = f"{severity}_downward_loss"
        else:
            directional_severity = severity
        
        return {
            "impacts": impacts,
            "severity": severity,
            "directional_severity": directional_severity,
            "direction": direction,
            "impact_count": len(impacts),
            "classification_correct": actual_segment == expected_segment,
        }


# ── Test Cases ───────────────────────────────────────────────────────────────

CROSS_FAMILY_TEST_CASES = [
    CrossFamilyTestCase(
        case_id="cross-001",
        user_context={
            "days_active": 5,
            "tasks_created": 10,
            "projects_created": 0,
            "due_dates_used": 2,
            "recurring_tasks_used": 0,
            "planning_sessions": 0,
            "features_used": ["quick_add", "task_list", "basic_search"],
            "last_active": "2026-04-04",
        },
        task_list=[
            {"title": "Buy groceries", "due_date": "2026-04-05", "priority": "medium"},
            {"title": "Call dentist", "due_date": "2026-04-06", "priority": "low"},
            {"title": "Submit expense report", "due_date": "2026-04-04", "priority": "high"},
        ],
        goal="Get organized this week",
        expected_segment="beginner",
        expected_planning_mode="lightweight_daily",
        expected_priority_order=["Submit expense report", "Buy groceries", "Call dentist"],
        expected_plan_steps=["Add tasks to list", "Set due dates", "Review daily plan"],
        notes="Beginner user with simple tasks. Should get basic planning mode.",
    ),
    CrossFamilyTestCase(
        case_id="cross-002",
        user_context={
            "days_active": 45,
            "tasks_created": 150,
            "projects_created": 5,
            "due_dates_used": 120,
            "recurring_tasks_used": 10,
            "planning_sessions": 10,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities"],
            "last_active": "2026-04-04",
        },
        task_list=[
            {"title": "Complete Q4 report", "due_date": "2026-04-10", "priority": "high", "project": "Work"},
            {"title": "Schedule team retrospective", "due_date": "2026-04-08", "priority": "medium", "project": "Work"},
            {"title": "Review design mockups", "due_date": "2026-04-07", "priority": "medium", "project": "Design"},
            {"title": "Update project timeline", "due_date": "2026-04-12", "priority": "high", "project": "Work", "depends_on": ["Complete Q4 report"]},
        ],
        goal="Plan the next sprint and complete Q4 deliverables",
        expected_segment="intermediate",
        expected_planning_mode="goal_aware_weekly",
        expected_priority_order=["Complete Q4 report", "Review design mockups", "Schedule team retrospective", "Update project timeline"],
        expected_plan_steps=["Review current sprint progress", "Complete Q4 report", "Schedule retrospective", "Update timeline"],
        notes="Intermediate user with projects and dependencies. Should get goal-aware planning.",
    ),
    CrossFamilyTestCase(
        case_id="cross-003",
        user_context={
            "days_active": 120,
            "tasks_created": 800,
            "projects_created": 20,
            "due_dates_used": 700,
            "recurring_tasks_used": 50,
            "planning_sessions": 60,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
            "last_active": "2026-04-04",
        },
        task_list=[
            {"title": "Deploy v2.0 to production", "due_date": "2026-04-15", "priority": "high", "project": "Release", "depends_on": ["Complete testing", "Update documentation"]},
            {"title": "Complete testing", "due_date": "2026-04-12", "priority": "high", "project": "Release"},
            {"title": "Update documentation", "due_date": "2026-04-13", "priority": "medium", "project": "Release"},
            {"title": "Plan Q2 roadmap", "due_date": "2026-04-20", "priority": "high", "project": "Strategy"},
            {"title": "Automate weekly reports", "due_date": "2026-04-18", "priority": "medium", "project": "Automation"},
        ],
        goal="Ship v2.0 and plan Q2 roadmap",
        expected_segment="advanced",
        expected_planning_mode="automation_bulk",
        expected_priority_order=["Complete testing", "Update documentation", "Deploy v2.0 to production", "Plan Q2 roadmap", "Automate weekly reports"],
        expected_plan_steps=["Complete testing", "Update documentation", "Deploy to production", "Plan Q2 roadmap", "Set up automation"],
        notes="Advanced user with complex dependencies. Should get automation/bulk planning.",
    ),
    CrossFamilyTestCase(
        case_id="cross-004",
        user_context={
            "days_active": 5,
            "tasks_created": 50,
            "projects_created": 5,
            "due_dates_used": 40,
            "recurring_tasks_used": 10,
            "planning_sessions": 3,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks"],
            "last_active": "2026-04-04",
        },
        task_list=[
            {"title": "Set up project structure", "due_date": "2026-04-05", "priority": "high"},
            {"title": "Invite team members", "due_date": "2026-04-06", "priority": "medium"},
            {"title": "Create recurring standup tasks", "due_date": "2026-04-07", "priority": "medium"},
        ],
        goal="Get team organized and collaborating",
        expected_segment="beginner",
        expected_planning_mode="lightweight_daily",
        expected_priority_order=["Set up project structure", "Invite team members", "Create recurring standup tasks"],
        expected_plan_steps=["Create project", "Add tasks", "Invite team", "Set up recurring tasks"],
        notes="High activity but only 5 days active. Should classify as beginner despite volume.",
    ),
    CrossFamilyTestCase(
        case_id="cross-005",
        user_context={
            "days_active": 200,
            "tasks_created": 1500,
            "projects_created": 40,
            "due_dates_used": 1200,
            "recurring_tasks_used": 100,
            "planning_sessions": 150,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph"],
            "last_active": "2026-04-04",
        },
        task_list=[
            {"title": "Run monthly automation report", "due_date": "2026-04-05", "priority": "high", "project": "Reporting", "automated": True},
            {"title": "Review agentic planning suggestions", "due_date": "2026-04-06", "priority": "medium", "project": "Automation"},
            {"title": "Optimize dependency graph", "due_date": "2026-04-10", "priority": "medium", "project": "System"},
        ],
        goal="Maintain automation and optimize workflows",
        expected_segment="power",
        expected_planning_mode="automation_bulk",
        expected_priority_order=["Run monthly automation report", "Review agentic planning suggestions", "Optimize dependency graph"],
        expected_plan_steps=["Run automation report", "Review suggestions", "Optimize dependencies"],
        notes="Power user with all features. Should get full automation/bulk planning.",
    ),
]


# ── CLI Runner ───────────────────────────────────────────────────────────────

async def run_all_cross_family_tests() -> dict[str, Any]:
    """Run all cross-family policy tests."""
    runner = CrossFamilyPolicyRunner()
    results = {}
    
    for test_case in CROSS_FAMILY_TEST_CASES:
        print(f"\n{'='*60}")
        print(f"Running cross-family test: {test_case.case_id}")
        print(f"Expected segment: {test_case.expected_segment}")
        print(f"{'='*60}")
        
        test_result = await runner.run_cross_family_test(test_case)
        results[test_case.case_id] = test_result
        
        # Print summary
        consistency = test_result.get("consistency", {})
        downstream = consistency.get("downstream_impact", {})
        fe_output = test_result.get("feature_exposure", {}).get("output", {})
        print(f"Actual segment: {consistency.get('actual_segment', 'unknown')}")
        print(f"Confidence: {consistency.get('confidence', 0):.2f}")
        print(f"Activity: {fe_output.get('activity_level', 'unknown')}, Capability: {fe_output.get('capability_level', 'unknown')}")
        print(f"Automation signals: {fe_output.get('automation_signal_count', 0)}")
        print(f"Consistent: {consistency.get('consistent', False)}")
        print(f"Downstream impact: {downstream.get('directional_severity', 'none')} ({downstream.get('impact_count', 0)} impacts)")

        if consistency.get("issues"):
            print("Issues:")
            for issue in consistency["issues"]:
                print(f"  ❌ {issue}")
        else:
            print("  ✅ No consistency issues")
        
        if downstream.get("impacts"):
            print("Downstream impacts:")
            for impact in downstream["impacts"]:
                print(f"  ⚠️ {impact}")
        
        if fe_output.get("gating_override"):
            print(f"Gating override: {fe_output['gating_override']}")
        
        # Print family scores
        for family_name in ["feature_exposure", "prioritization", "plan_from_goal"]:
            if family_name in test_result:
                score = test_result[family_name]["result"]["score"]
                print(f"  {family_name}: {score:.3f}")
    
    # Overall summary
    print(f"\n{'='*60}")
    print(f"CROSS-FAMILY POLICY TEST SUMMARY")
    print(f"{'='*60}")

    total_tests = len(results)
    consistent_tests = sum(1 for r in results.values() if r.get("consistency", {}).get("consistent", False))
    print(f"Tests: {total_tests}")
    print(f"Consistent: {consistent_tests}/{total_tests}")
    print(f"Consistency rate: {consistent_tests/total_tests:.1%}")
    
    # Downstream impact summary
    impact_severities = [r.get("consistency", {}).get("downstream_impact", {}).get("directional_severity", "none") for r in results.values()]
    upward_risks = sum(1 for s in impact_severities if "upward_risk" in s)
    downward_losses = sum(1 for s in impact_severities if "downward_loss" in s)
    no_impacts = sum(1 for s in impact_severities if s == "none")
    print(f"\nDownstream Impact Summary:")
    print(f"  Upward risk: {upward_risks}, Downward loss: {downward_losses}, None: {no_impacts}")
    
    # Gating override summary
    gating_overrides = sum(1 for r in results.values() if r.get("feature_exposure", {}).get("output", {}).get("gating_override"))
    print(f"  Gating overrides: {gating_overrides}")

    # Confusion matrix
    print(f"\nConfusion Matrix:")
    segments = ["beginner", "intermediate", "advanced", "power"]
    print(f"{'Expected':<15} {'Actual':<15} {'Direction':<15} {'Gating':<10}")
    print("-" * 55)
    for test_case in CROSS_FAMILY_TEST_CASES:
        actual = results[test_case.case_id].get("consistency", {}).get("actual_segment", "unknown")
        direction = results[test_case.case_id].get("consistency", {}).get("downstream_impact", {}).get("direction", "none")
        fe_output = results[test_case.case_id].get("feature_exposure", {}).get("output", {})
        gating = "YES" if fe_output.get("gating_override") else "no"
        print(f"{test_case.expected_segment:<15} {actual:<15} {direction:<15} {gating:<10}")
    
    # Gate hit-rate report
    from families.feature_exposure import FeatureExposureFamily
    gate_report = FeatureExposureFamily.get_gate_hit_report()
    if gate_report.get("total_cases", 0) > 0:
        print(f"\n{'='*60}")
        print(f"GATE HIT-RATE REPORT")
        print(f"{'='*60}")
        print(f"Total cases: {gate_report['total_cases']}")
        print(f"False conservatism rate: {gate_report.get('false_conservatism_rate', 0):.1%}")
        print(f"\nGate hits:")
        for gate_name, info in sorted(gate_report.get("gates", {}).items(), key=lambda x: x[1]["hits"], reverse=True):
            print(f"  {gate_name}: {info['hits']} ({info['percentage']})")
        print(f"\nTop 3 gates:")
        for gate in gate_report.get("top_gates", []):
            print(f"  {gate['name']}: {gate['hits']} hits")

    return results


async def main():
    results = await run_all_cross_family_tests()
    
    # Save results
    output_dir = Path(__file__).parent / "results" / "cross-family"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = output_dir / f"cross-family-{run_id}.json"
    
    # Convert results to JSON-serializable format
    serializable_results = {}
    for case_id, result in results.items():
        serializable_results[case_id] = {
            "feature_exposure": result.get("feature_exposure", {}),
            "prioritization": result.get("prioritization", {}),
            "plan_from_goal": result.get("plan_from_goal", {}),
            "consistency": result.get("consistency", {}),
        }
    
    with open(output_path, "w") as f:
        json.dump(serializable_results, f, indent=2)
    
    print(f"\nResults saved to: {output_path}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
