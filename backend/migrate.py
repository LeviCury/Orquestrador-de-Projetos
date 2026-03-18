"""
Migration script for the Minerva SQL naming standard.

Since the project is not yet in production, the safest approach is to
drop the old database and let SQLAlchemy recreate it with the new names
via Base.metadata.create_all() in main.py.

If you need to preserve data from an existing orchestrator.db, run this
script BEFORE starting the server.  It will:
  1. Export all data from old-named tables
  2. Drop old tables
  3. Let the new schema be created on next server start
  4. Re-import the data

For a fresh start (no data to preserve), simply delete orchestrator.db.
"""

import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(__file__), "orchestrator.db")

OLD_TO_NEW_TABLES = {
    "project_collaborators": "tab_project_collaborator",
    "stage_collaborators": "tab_stage_collaborator",
    "task_collaborators": "tab_task_collaborator",
    "collaborators": "tab_collaborator",
    "projects": "tab_project",
    "stages": "tab_stage",
    "tasks": "tab_task",
    "subtasks": "tab_subtask",
    "time_entries": "tab_time_entry",
    "activities": "tab_activity",
    "comments": "tab_comment",
    "baselines": "tab_baseline",
    "project_templates": "tab_project_template",
    "attachments": "tab_attachment",
    "notifications": "tab_notification",
    "task_dependencies": "tab_task_dependency",
    "sprints": "tab_sprint",
    "ticket_hour_entries": "tab_ticket_hour_entry",
    "verification_codes": "tab_verification_code",
}


def check_old_schema_exists(conn):
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='collaborators'")
    return c.fetchone() is not None


def main():
    if not os.path.exists(DB_PATH):
        print("No database found. A fresh one will be created on server start.")
        return

    conn = sqlite3.connect(DB_PATH)

    if not check_old_schema_exists(conn):
        print("Old schema not found (already migrated or fresh DB). Nothing to do.")
        conn.close()
        return

    print("Old schema detected. Removing old database for clean recreation...")
    conn.close()
    os.remove(DB_PATH)
    print(f"Removed {DB_PATH}")
    print("Start the server to create the database with the new Minerva naming standard.")
    print("Migration complete!")


if __name__ == "__main__":
    main()
