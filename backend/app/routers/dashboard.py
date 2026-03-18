from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date, timedelta
from typing import Optional

from ..database import get_db
from ..models import Project, Stage, Task, Collaborator, TimeEntry, TicketHourEntry
from ..schemas import (
    DashboardSummary, DashboardSummaryFiltered,
    HoursComparison, StatusDistribution, DelayedItem,
    TimelineBar, ProjectTimelineResponse,
    ExecutiveDashboard, ProjectHealthRow, CollaboratorLoad, SCurvePoint,
    TeamOverview, CollaboratorWorkRow, TicketStats,
)

router = APIRouter()


def _estimated_hours_for(db: Session, project_id: int) -> float:
    """Compute estimated hours from tasks; fall back to stages, then project."""
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        return 0.0
    stages = db.query(Stage).filter(Stage.project_id == project_id).all()
    tasks = db.query(Task).join(Stage).filter(Stage.project_id == project_id).all()
    hours = sum(t.estimated_hours or 0 for t in tasks)
    if not hours:
        hours = sum(s.estimated_hours or 0 for s in stages)
    if not hours:
        hours = float(p.estimated_hours or 0)
    return float(hours)


def _planned_end_for(db: Session, project_id: int):
    """Derive planned_end from the latest task/stage end date; fall back to project."""
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        return None
    tasks = db.query(Task).join(Stage).filter(Stage.project_id == project_id).all()
    task_ends = [t.planned_end for t in tasks if t.planned_end]
    if task_ends:
        return max(task_ends)
    stages = db.query(Stage).filter(Stage.project_id == project_id).all()
    stage_ends = [s.planned_end for s in stages if s.planned_end]
    if stage_ends:
        return max(stage_ends)
    return p.planned_end


def _actual_hours_for(db: Session, project_id: int, stage_id: int | None = None, task_id: int | None = None) -> float:
    q = db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).filter(TimeEntry.project_id == project_id)
    if task_id:
        q = q.filter(TimeEntry.task_id == task_id)
    elif stage_id:
        q = q.filter(TimeEntry.stage_id == stage_id)
    return float(q.scalar())


def _calc_days(planned_start, planned_end, actual_start, actual_end) -> tuple[int, int, int]:
    today = date.today()
    planned_days = 0
    if planned_start and planned_end:
        planned_days = max((planned_end - planned_start).days, 0)

    actual_days = 0
    if actual_start:
        end = actual_end or today
        actual_days = max((end - actual_start).days, 0)

    days_delta = actual_days - planned_days if planned_days > 0 else 0
    return planned_days, actual_days, days_delta


@router.get("/summary", response_model=DashboardSummaryFiltered)
def get_summary(project_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    if project_id:
        p = db.query(Project).filter(Project.id == project_id).first()
        if not p:
            return DashboardSummaryFiltered(
                total_projects=0, active_projects=0, completed_projects=0,
                delayed_projects=0, total_collaborators=0,
                total_hours_estimated=0, total_hours_actual=0,
            )
        today = date.today()
        stages = db.query(Stage).filter(Stage.project_id == project_id).all()
        tasks_q = db.query(Task).join(Stage).filter(Stage.project_id == project_id)
        total_tasks = tasks_q.count()
        active_tasks = tasks_q.filter(Task.status == "in_progress").count()
        completed_tasks = tasks_q.filter(Task.status == "completed").count()
        delayed_tasks = tasks_q.filter(Task.planned_end < today, Task.status.notin_(["completed", "cancelled"])).count()
        collabs = len(p.collaborators)
        est = _estimated_hours_for(db, project_id)
        act = _actual_hours_for(db, project_id)
        pd, ad, dd = _calc_days(p.planned_start, p.planned_end, p.actual_start, p.actual_end)
        return DashboardSummaryFiltered(
            total_projects=len(stages),
            active_projects=active_tasks,
            completed_projects=completed_tasks,
            delayed_projects=delayed_tasks,
            total_collaborators=collabs,
            total_hours_estimated=float(est),
            total_hours_actual=float(act),
            project_name=p.name,
            total_planned_days=pd,
            total_actual_days=ad,
            total_days_delta=dd,
        )

    total = db.query(func.count(Project.id)).scalar()
    active = db.query(func.count(Project.id)).filter(Project.status == "in_progress").scalar()
    completed = db.query(func.count(Project.id)).filter(Project.status == "completed").scalar()
    today = date.today()
    delayed = db.query(func.count(Project.id)).filter(
        Project.planned_end < today,
        Project.status.notin_(["completed", "cancelled"]),
    ).scalar()
    total_collabs = db.query(func.count(Collaborator.id)).filter(Collaborator.active == True).scalar()
    est_hours = sum(_estimated_hours_for(db, pp.id) for pp in db.query(Project).all())
    act_hours = db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).scalar()
    all_projects = db.query(Project).all()
    global_pd, global_ad = 0, 0
    for pp in all_projects:
        ppd, pad, _ = _calc_days(pp.planned_start, pp.planned_end, pp.actual_start, pp.actual_end)
        global_pd += ppd
        global_ad += pad
    return DashboardSummaryFiltered(
        total_projects=total, active_projects=active, completed_projects=completed,
        delayed_projects=delayed, total_collaborators=total_collabs,
        total_hours_estimated=float(est_hours), total_hours_actual=float(act_hours),
        total_planned_days=global_pd, total_actual_days=global_ad,
        total_days_delta=global_ad - global_pd if global_pd > 0 else 0,
    )


@router.get("/hours-comparison", response_model=list[HoursComparison])
def hours_comparison(project_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    if project_id:
        stages = db.query(Stage).filter(Stage.project_id == project_id).order_by(Stage.order_index).all()
        result = []
        for s in stages:
            actual = _actual_hours_for(db, project_id, stage_id=s.id)
            result.append(HoursComparison(project_id=s.id, project_name=s.name, estimated_hours=s.estimated_hours, actual_hours=actual))
        return result

    projects = db.query(Project).all()
    result = []
    for p in projects:
        actual = _actual_hours_for(db, p.id)
        result.append(HoursComparison(project_id=p.id, project_name=p.name, estimated_hours=_estimated_hours_for(db, p.id), actual_hours=float(actual)))
    return result


@router.get("/status-distribution", response_model=list[StatusDistribution])
def status_distribution(project_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    if project_id:
        rows = (
            db.query(Task.status, func.count(Task.id))
            .join(Stage).filter(Stage.project_id == project_id)
            .group_by(Task.status).all()
        )
        return [StatusDistribution(status=r[0], count=r[1]) for r in rows]

    rows = db.query(Project.status, func.count(Project.id)).group_by(Project.status).all()
    return [StatusDistribution(status=r[0], count=r[1]) for r in rows]


@router.get("/delayed-items", response_model=list[DelayedItem])
def delayed_items(project_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    today = date.today()
    items: list[DelayedItem] = []

    if project_id:
        stages = db.query(Stage).filter(
            Stage.project_id == project_id,
            Stage.planned_end < today,
            Stage.status.notin_(["completed", "cancelled"]),
        ).all()
        for s in stages:
            days = (today - s.planned_end).days
            items.append(DelayedItem(id=s.id, name=s.name, item_type="stage", planned_end=s.planned_end, days_delayed=days, project_name=s.project.name))

        tasks = db.query(Task).join(Stage).filter(
            Stage.project_id == project_id,
            Task.planned_end < today,
            Task.status.notin_(["completed", "cancelled"]),
        ).all()
        for t in tasks:
            days = (today - t.planned_end).days
            items.append(DelayedItem(id=t.id, name=t.name, item_type="task", planned_end=t.planned_end, days_delayed=days, project_name=t.stage.project.name))
        items.sort(key=lambda x: x.days_delayed, reverse=True)
        return items

    projects = db.query(Project).filter(
        Project.planned_end < today,
        Project.status.notin_(["completed", "cancelled"]),
    ).all()
    for p in projects:
        days = (today - p.planned_end).days
        items.append(DelayedItem(id=p.id, name=p.name, item_type="project", planned_end=p.planned_end, days_delayed=days, project_name=p.name))

    stages = db.query(Stage).join(Project).filter(
        Stage.planned_end < today,
        Stage.status.notin_(["completed", "cancelled"]),
    ).all()
    for s in stages:
        days = (today - s.planned_end).days
        items.append(DelayedItem(id=s.id, name=s.name, item_type="stage", planned_end=s.planned_end, days_delayed=days, project_name=s.project.name))

    tasks = db.query(Task).join(Stage).join(Project).filter(
        Task.planned_end < today,
        Task.status.notin_(["completed", "cancelled"]),
    ).all()
    for t in tasks:
        days = (today - t.planned_end).days
        items.append(DelayedItem(id=t.id, name=t.name, item_type="task", planned_end=t.planned_end, days_delayed=days, project_name=t.stage.project.name))

    items.sort(key=lambda x: x.days_delayed, reverse=True)
    return items


@router.get("/timeline", response_model=list[ProjectTimelineResponse])
def get_timeline(project_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    if project_id:
        projects = db.query(Project).options(
            joinedload(Project.stages).joinedload(Stage.tasks)
        ).filter(Project.id == project_id).all()
    else:
        projects = db.query(Project).options(
            joinedload(Project.stages).joinedload(Stage.tasks)
        ).all()

    results = []
    for p in projects:
        bars: list[TimelineBar] = []
        all_dates: list[date] = []
        stage_ids = []

        for s in p.stages:
            task_ids = []
            task_bars: list[TimelineBar] = []
            for t in s.tasks:
                t_actual = _actual_hours_for(db, p.id, task_id=t.id)
                t_pd, t_ad, t_dd = _calc_days(t.planned_start, t.planned_end, t.actual_start, t.actual_end)
                task_bars.append(TimelineBar(
                    id=t.id, name=t.name, level="task", status=t.status,
                    planned_start=t.planned_start, planned_end=t.planned_end,
                    actual_start=t.actual_start, actual_end=t.actual_end,
                    estimated_hours=t.estimated_hours, actual_hours=t_actual,
                    planned_days=t_pd, actual_days=t_ad, days_delta=t_dd,
                    hours_delta=round(t_actual - t.estimated_hours, 1),
                    parent_id=s.id,
                ))
                task_ids.append(t.id)
                for d in [t.planned_start, t.planned_end, t.actual_start, t.actual_end]:
                    if d:
                        all_dates.append(d)

            s_actual = _actual_hours_for(db, p.id, stage_id=s.id)
            s_pd, s_ad, s_dd = _calc_days(s.planned_start, s.planned_end, s.actual_start, s.actual_end)
            bars.append(TimelineBar(
                id=s.id, name=s.name, level="stage", status=s.status,
                planned_start=s.planned_start, planned_end=s.planned_end,
                actual_start=s.actual_start, actual_end=s.actual_end,
                estimated_hours=s.estimated_hours, actual_hours=s_actual,
                planned_days=s_pd, actual_days=s_ad, days_delta=s_dd,
                hours_delta=round(s_actual - s.estimated_hours, 1),
                parent_id=p.id, children_ids=task_ids,
            ))
            bars.extend(task_bars)
            stage_ids.append(s.id)
            for d in [s.planned_start, s.planned_end, s.actual_start, s.actual_end]:
                if d:
                    all_dates.append(d)

        p_actual = _actual_hours_for(db, p.id)
        p_pd, p_ad, p_dd = _calc_days(p.planned_start, p.planned_end, p.actual_start, p.actual_end)
        bars.insert(0, TimelineBar(
            id=p.id, name=p.name, level="project", status=p.status,
            planned_start=p.planned_start, planned_end=p.planned_end,
            actual_start=p.actual_start, actual_end=p.actual_end,
            estimated_hours=p.estimated_hours, actual_hours=p_actual,
            planned_days=p_pd, actual_days=p_ad, days_delta=p_dd,
            hours_delta=round(p_actual - p.estimated_hours, 1),
            children_ids=stage_ids,
        ))
        for d in [p.planned_start, p.planned_end, p.actual_start, p.actual_end]:
            if d:
                all_dates.append(d)

        results.append(ProjectTimelineResponse(
            project_id=p.id,
            project_name=p.name,
            bars=bars,
            earliest_date=min(all_dates) if all_dates else None,
            latest_date=max(all_dates) if all_dates else None,
            total_planned_days=p_pd,
            total_actual_days=p_ad,
            total_days_delta=p_dd,
        ))

    return results


@router.get("/executive", response_model=ExecutiveDashboard)
def executive_dashboard(project_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    from collections import defaultdict
    today = date.today()

    if project_id:
        all_projects = db.query(Project).filter(Project.id == project_id).all()
    else:
        all_projects = db.query(Project).all()

    total_pv = 0.0
    total_ev = 0.0
    total_ac = 0.0
    on_schedule_count = 0
    within_budget_count = 0
    risk_count = 0
    schedule_devs: list[float] = []
    hours_devs: list[float] = []
    health_rows: list[ProjectHealthRow] = []

    for p in all_projects:
        est = _estimated_hours_for(db, p.id)
        actual = float(_actual_hours_for(db, p.id))
        pd_val, ad_val, dd_val = _calc_days(p.planned_start, p.planned_end, p.actual_start, p.actual_end)

        tasks_q = db.query(Task).join(Stage).filter(Stage.project_id == p.id)
        total_tasks = tasks_q.count()
        completed_tasks = tasks_q.filter(Task.status == "completed").count()

        progress = (completed_tasks / total_tasks) if total_tasks > 0 else 0.0

        planned_progress = 0.0
        if p.planned_start and p.planned_end and p.planned_end > p.planned_start:
            total_planned = (p.planned_end - p.planned_start).days
            if total_planned > 0:
                elapsed = (today - p.planned_start).days
                planned_progress = min(max(elapsed / total_planned, 0), 1.0)

        pv = est * planned_progress
        ev = est * progress
        ac = actual

        total_pv += pv
        total_ev += ev
        total_ac += ac

        spi = (ev / pv) if pv > 0 else (1.0 if progress > 0 else 0.0)
        cpi = (ev / ac) if ac > 0 else (1.0 if ev == 0 else 0.0)

        pct_sched = (ad_val / pd_val * 100) if pd_val > 0 else 0
        pct_hrs = (actual / est * 100) if est > 0 else 0

        is_on_schedule = dd_val <= 0 or p.status in ("completed", "cancelled")
        is_within_budget = actual <= est * 1.05 or p.status in ("completed", "cancelled")

        if is_on_schedule:
            on_schedule_count += 1
        if is_within_budget:
            within_budget_count += 1

        if pd_val > 0:
            schedule_devs.append(((ad_val - pd_val) / pd_val) * 100)
        if est > 0:
            hours_devs.append(((actual - est) / est) * 100)

        risk = "low"
        if p.status in ("completed", "cancelled"):
            risk = "low"
        elif spi < 0.8 or cpi < 0.8:
            risk = "high"
        elif spi < 0.95 or cpi < 0.95:
            risk = "medium"

        if risk in ("high",):
            risk_count += 1

        health_rows.append(ProjectHealthRow(
            id=p.id, name=p.name, status=p.status,
            complexity=p.complexity, criticality=p.criticality,
            spi=round(spi, 2), cpi_hours=round(cpi, 2),
            pct_schedule=round(pct_sched, 1), pct_hours=round(pct_hrs, 1),
            planned_hours=est, actual_hours=actual,
            planned_days=pd_val, actual_days=ad_val,
            days_delta=dd_val, hours_delta=round(actual - est, 1),
            risk_level=risk,
            planned_end=_planned_end_for(db, p.id),
        ))

    n = len(all_projects) or 1
    portfolio_spi = (total_ev / total_pv) if total_pv > 0 else 1.0
    portfolio_cpi = (total_ev / total_ac) if total_ac > 0 else 1.0

    collab_hours = defaultdict(lambda: {"hours": 0.0, "projects": set()})
    collab_est = defaultdict(float)

    analyst_ids = set(
        cid for (cid,) in db.query(Collaborator.id).filter(
            Collaborator.active == True, Collaborator.system_role == "analyst"
        ).all()
    )

    entries = db.query(TimeEntry).all() if not project_id else db.query(TimeEntry).filter(TimeEntry.project_id == project_id).all()
    for te in entries:
        if te.collaborator_id not in analyst_ids:
            continue
        collab_hours[te.collaborator_id]["hours"] += te.hours_worked
        collab_hours[te.collaborator_id]["projects"].add(te.project_id)

    for p in all_projects:
        est = _estimated_hours_for(db, p.id)
        analyst_collabs = [c for c in p.collaborators if c.id in analyst_ids]
        n_collabs = len(analyst_collabs) or 1
        for c in analyst_collabs:
            collab_est[c.id] += est / n_collabs

    collaborators = db.query(Collaborator).filter(Collaborator.active == True, Collaborator.system_role == "analyst").all()
    collab_load: list[CollaboratorLoad] = []
    for c in collaborators:
        ch = collab_hours.get(c.id, {"hours": 0.0, "projects": set()})
        total_h = ch["hours"]
        est_cap = collab_est.get(c.id, 0)
        load = (total_h / est_cap * 100) if est_cap > 0 else 0
        dev = ((total_h - est_cap) / est_cap * 100) if est_cap > 0 else 0
        collab_load.append(CollaboratorLoad(
            id=c.id, name=c.name,
            total_hours=round(total_h, 1),
            estimated_capacity=round(est_cap, 1),
            load_pct=round(load, 1),
            project_count=len(ch["projects"]),
            deviation_pct=round(dev, 1),
        ))
    collab_load.sort(key=lambda x: x.load_pct, reverse=True)

    s_curve: list[SCurvePoint] = []
    if all_projects:
        all_entries = entries
        min_date = None
        for p in all_projects:
            if p.planned_start:
                if not min_date or p.planned_start < min_date:
                    min_date = p.planned_start

        if min_date:
            from datetime import timedelta
            end_date = today + timedelta(days=7)
            total_est = sum(_estimated_hours_for(db, p.id) for p in all_projects)

            max_planned_days = 0
            for p in all_projects:
                if p.planned_start and p.planned_end:
                    d = (p.planned_end - p.planned_start).days
                    if d > max_planned_days:
                        max_planned_days = d
            if max_planned_days == 0:
                max_planned_days = (end_date - min_date).days or 1

            entry_map = defaultdict(float)
            for te in all_entries:
                entry_map[te.entry_date] += te.hours_worked

            cursor = min_date
            planned_cum = 0.0
            actual_cum = 0.0
            daily_planned = total_est / max_planned_days if max_planned_days > 0 else 0

            while cursor <= end_date:
                if cursor <= today:
                    actual_cum += entry_map.get(cursor, 0)
                if daily_planned > 0 and planned_cum < total_est:
                    planned_cum += daily_planned

                if cursor.day == 1 or cursor == min_date or cursor == today or cursor == end_date:
                    s_curve.append(SCurvePoint(
                        date=cursor.isoformat(),
                        planned_cumulative=round(min(planned_cum, total_est), 1),
                        actual_cumulative=round(actual_cum, 1),
                    ))
                cursor += timedelta(days=1)

    completed_count = sum(1 for p in all_projects if p.status == "completed")
    in_progress_count = sum(1 for p in all_projects if p.status == "in_progress")
    delayed_count = sum(1 for p in all_projects
                        if p.planned_end and p.planned_end < today
                        and p.status not in ("completed", "cancelled"))

    total_project_hours = float(
        db.query(func.coalesce(func.sum(TimeEntry.hours_worked), 0)).scalar()
    )
    total_ticket_hours = float(
        db.query(func.coalesce(func.sum(TicketHourEntry.hours_worked), 0)).scalar()
    )
    ticket_count = db.query(TicketHourEntry).count()
    unique_tix = db.query(func.count(func.distinct(TicketHourEntry.glpi_ticket_id))).filter(
        TicketHourEntry.glpi_ticket_id != ""
    ).scalar() or 0

    return ExecutiveDashboard(
        pct_on_schedule=round((on_schedule_count / n) * 100, 1) if n else 0,
        pct_within_budget=round((within_budget_count / n) * 100, 1) if n else 0,
        projects_at_risk=risk_count,
        avg_schedule_deviation=round(sum(schedule_devs) / len(schedule_devs), 1) if schedule_devs else 0,
        avg_hours_deviation=round(sum(hours_devs) / len(hours_devs), 1) if hours_devs else 0,
        total_ev=round(total_ev, 1),
        total_pv=round(total_pv, 1),
        total_ac=round(total_ac, 1),
        portfolio_spi=round(portfolio_spi, 2),
        portfolio_cpi=round(portfolio_cpi, 2),
        project_health=health_rows,
        collaborator_load=collab_load,
        s_curve=s_curve,
        total_projects=len(all_projects),
        total_completed=completed_count,
        total_in_progress=in_progress_count,
        total_delayed=delayed_count,
        total_project_hours=round(total_project_hours, 1),
        total_ticket_hours=round(total_ticket_hours, 1),
        total_all_hours=round(total_project_hours + total_ticket_hours, 1),
        ticket_entries_count=ticket_count,
        unique_tickets_count=unique_tix,
    )


@router.get("/workload/{project_id}")
def get_project_workload(project_id: int, db: Session = Depends(get_db)):
    from ..models import project_collaborators, task_collaborators

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    collab_ids = [c.id for c in project.collaborators if c.system_role == "analyst"]
    if not collab_ids:
        return []

    today = date.today()
    start_of_range = today - timedelta(weeks=4)
    end_of_range = today + timedelta(weeks=8)

    entries = db.query(
        TimeEntry.collaborator_id,
        TimeEntry.entry_date,
        func.sum(TimeEntry.hours_worked).label("total"),
    ).filter(
        TimeEntry.project_id == project_id,
        TimeEntry.collaborator_id.in_(collab_ids),
        TimeEntry.entry_date >= start_of_range,
        TimeEntry.entry_date <= end_of_range,
    ).group_by(TimeEntry.collaborator_id, TimeEntry.entry_date).all()

    collab_names = {c.id: c.name for c in db.query(Collaborator).filter(Collaborator.id.in_(collab_ids)).all()}

    all_tasks = []
    for s in db.query(Stage).filter(Stage.project_id == project_id).all():
        for t in s.tasks:
            all_tasks.append(t)

    task_allocations: dict[int, list] = {}
    for t in all_tasks:
        if t.planned_start and t.planned_end and t.estimated_hours > 0:
            days = max((t.planned_end - t.planned_start).days, 1)
            hours_per_day = t.estimated_hours / days
            for c in t.collaborators:
                task_allocations.setdefault(c.id, []).append({
                    "start": t.planned_start, "end": t.planned_end,
                    "hours_per_day": hours_per_day / max(len(t.collaborators), 1),
                })

    def get_monday(d):
        return d - timedelta(days=d.weekday())

    weeks_in_range = []
    current = get_monday(start_of_range)
    while current <= end_of_range:
        weeks_in_range.append(current)
        current += timedelta(weeks=1)

    logged_by_week: dict[tuple, float] = {}
    for e in entries:
        wk = get_monday(e.entry_date)
        key = (e.collaborator_id, str(wk))
        logged_by_week[key] = logged_by_week.get(key, 0) + float(e.total)

    result = []
    for cid in collab_ids:
        for wk in weeks_in_range:
            allocated = 0.0
            for alloc in task_allocations.get(cid, []):
                for d in range(7):
                    day = wk + timedelta(days=d)
                    if alloc["start"] <= day <= alloc["end"] and d < 5:
                        allocated += alloc["hours_per_day"]

            logged = logged_by_week.get((cid, str(wk)), 0)
            result.append({
                "collaborator_id": cid,
                "collaborator_name": collab_names.get(cid, ""),
                "week_start": str(wk),
                "allocated_hours": round(allocated, 1),
                "logged_hours": round(logged, 1),
                "capacity_hours": 40,
            })

    return result


@router.get("/team-overview", response_model=TeamOverview)
def team_overview(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    from collections import defaultdict

    today = date.today()
    period_start = today - timedelta(days=days - 1)

    collaborators = db.query(Collaborator).filter(Collaborator.active == True, Collaborator.system_role == "analyst").all()

    project_entries = (
        db.query(TimeEntry.collaborator_id, TimeEntry.entry_date, func.sum(TimeEntry.hours_worked))
        .filter(TimeEntry.entry_date >= period_start, TimeEntry.entry_date <= today)
        .group_by(TimeEntry.collaborator_id, TimeEntry.entry_date)
        .all()
    )

    ticket_entries = (
        db.query(TicketHourEntry.collaborator_id, TicketHourEntry.entry_date, func.sum(TicketHourEntry.hours_worked))
        .filter(TicketHourEntry.entry_date >= period_start, TicketHourEntry.entry_date <= today)
        .group_by(TicketHourEntry.collaborator_id, TicketHourEntry.entry_date)
        .all()
    )

    proj_by_collab: dict[int, float] = defaultdict(float)
    proj_days_by_collab: dict[int, set] = defaultdict(set)
    daily_proj: dict[str, float] = defaultdict(float)
    for cid, edate, hrs in project_entries:
        proj_by_collab[cid] += float(hrs)
        proj_days_by_collab[cid].add(edate)
        daily_proj[edate.isoformat()] += float(hrs)

    tick_by_collab: dict[int, float] = defaultdict(float)
    tick_days_by_collab: dict[int, set] = defaultdict(set)
    daily_tick: dict[str, float] = defaultdict(float)
    for cid, edate, hrs in ticket_entries:
        tick_by_collab[cid] += float(hrs)
        tick_days_by_collab[cid].add(edate)
        daily_tick[edate.isoformat()] += float(hrs)

    total_proj = sum(proj_by_collab.values())
    total_tick = sum(tick_by_collab.values())
    total_all = total_proj + total_tick

    rows: list[CollaboratorWorkRow] = []
    for c in collaborators:
        ph = round(proj_by_collab.get(c.id, 0), 1)
        th = round(tick_by_collab.get(c.id, 0), 1)
        tot = ph + th
        all_days = proj_days_by_collab.get(c.id, set()) | tick_days_by_collab.get(c.id, set())
        wd = len(all_days)
        target = wd * 9.0
        adh = round((tot / target) * 100, 1) if target > 0 else 0
        avg_d = round(tot / wd, 1) if wd > 0 else 0
        pp = round((ph / tot) * 100, 1) if tot > 0 else 0
        tp = round((th / tot) * 100, 1) if tot > 0 else 0
        rows.append(CollaboratorWorkRow(
            id=c.id, name=c.name, role=c.role,
            project_hours=ph, ticket_hours=th, total_hours=round(tot, 1),
            target_hours=round(target, 1), adherence_pct=adh,
            project_pct=pp, ticket_pct=tp,
            avg_daily_hours=avg_d, working_days=wd,
        ))
    rows.sort(key=lambda r: r.total_hours, reverse=True)

    all_ticket_entries = (
        db.query(TicketHourEntry)
        .filter(TicketHourEntry.entry_date >= period_start, TicketHourEntry.entry_date <= today)
        .all()
    )
    unique_tickets = set()
    for te in all_ticket_entries:
        if te.glpi_ticket_id:
            unique_tickets.add(te.glpi_ticket_id)

    ticket_stats = TicketStats(
        total_entries=len(all_ticket_entries),
        total_hours=round(total_tick, 1),
        unique_tickets=len(unique_tickets),
        avg_hours_per_ticket=round(total_tick / len(unique_tickets), 1) if unique_tickets else 0,
    )

    all_dates = set()
    for d_str in list(daily_proj.keys()) + list(daily_tick.keys()):
        all_dates.add(d_str)

    daily_dist = []
    for d_str in sorted(all_dates):
        daily_dist.append({
            "date": d_str,
            "project_hours": round(daily_proj.get(d_str, 0), 1),
            "ticket_hours": round(daily_tick.get(d_str, 0), 1),
            "total": round(daily_proj.get(d_str, 0) + daily_tick.get(d_str, 0), 1),
        })

    return TeamOverview(
        period_start=period_start,
        period_end=today,
        total_project_hours=round(total_proj, 1),
        total_ticket_hours=round(total_tick, 1),
        total_hours=round(total_all, 1),
        project_pct=round((total_proj / total_all) * 100, 1) if total_all > 0 else 0,
        ticket_pct=round((total_tick / total_all) * 100, 1) if total_all > 0 else 0,
        collaborators=rows,
        ticket_stats=ticket_stats,
        daily_distribution=daily_dist,
    )
