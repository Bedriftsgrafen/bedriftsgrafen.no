---
description: How to create, apply, and verify database migrations safely
---

# Database Migration Workflow

Use this workflow when modifying the database schema (Models).

## 1. Create Migration (Local)

1.  **Modify the Model**: Update `backend/models/*.py`.
2.  **Generate Migration**:
    ```bash
    cd backend
    # Make sure your message describes the change clearly
    alembic revision --autogenerate -m "describe_your_change"
    ```
3.  **Review the file**: check `backend/alembic/versions/<new_id>_*.py`. Ensure it only contains intended changes.

## 2. Apply Migration (Local)

1.  **Upgrade Database**:
    ```bash
    alembic upgrade head
    ```
2.  **Verify**: Check if the changes are reflected in the database (e.g., table created, column added).

## 3. Commit Strategy

-   **Commit Migration separately**:
    ```bash
    git add backend/alembic/versions/
    git commit -m "chore(db): add migration for <feature>"
    ```
-   **Push Incrementally**: Follow the `git_push` workflow.
