import os
import subprocess
from pathlib import Path

BASH = "/usr/bin/bash"
REPO_ROOT = Path(__file__).resolve().parents[4]
SYNC_SCRIPT = REPO_ROOT / "scripts" / "sync-venv.sh"


def _write_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(0o755)


def _run_sync(venv_dir: Path, requirements_file: Path, **extra_env: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.update(
        {
            "VENV_DIR": str(venv_dir),
            "REQ_FILE": str(requirements_file),
            **extra_env,
        }
    )
    return subprocess.run(  # noqa: S603 - the test executes a repository-owned script
        [BASH, str(SYNC_SCRIPT)],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )


def test_sync_venv_exits_cleanly_when_venv_is_missing(tmp_path):
    result = _run_sync(tmp_path / "missing-venv", tmp_path / "requirements.txt")

    assert result.returncode == 0


def test_sync_venv_runs_pip_sync_every_time(tmp_path):
    venv_dir = tmp_path / "venv"
    bin_dir = venv_dir / "bin"
    bin_dir.mkdir(parents=True)
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("example==1.0\n", encoding="utf-8")
    sync_log = tmp_path / "sync.log"

    _write_executable(bin_dir / "python", "#!/usr/bin/env bash\nexit 0\n")
    _write_executable(
        bin_dir / "pip-sync",
        '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$SYNC_LOG"\n',
    )

    first = _run_sync(venv_dir, requirements_file, SYNC_LOG=str(sync_log))
    second = _run_sync(venv_dir, requirements_file, SYNC_LOG=str(sync_log))

    assert first.returncode == 0
    assert second.returncode == 0
    assert sync_log.read_text(encoding="utf-8").splitlines() == [str(requirements_file), str(requirements_file)]


def test_sync_venv_bootstraps_pip_tools_from_requirements(tmp_path):
    venv_dir = tmp_path / "venv"
    bin_dir = venv_dir / "bin"
    bin_dir.mkdir(parents=True)
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("pip-tools==7.6.1\n", encoding="utf-8")
    bootstrap_log = tmp_path / "bootstrap.log"
    sync_log = tmp_path / "sync.log"

    _write_executable(
        bin_dir / "python",
        '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$BOOTSTRAP_LOG"\nchmod +x "$VENV_DIR/bin/pip-sync"\n',
    )
    (bin_dir / "pip-sync").write_text(
        '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$SYNC_LOG"\n',
        encoding="utf-8",
    )

    result = _run_sync(
        venv_dir,
        requirements_file,
        BOOTSTRAP_LOG=str(bootstrap_log),
        SYNC_LOG=str(sync_log),
    )

    assert result.returncode == 0
    assert bootstrap_log.read_text(encoding="utf-8").strip() == f"-m pip install --requirement {requirements_file}"
    assert sync_log.read_text(encoding="utf-8").strip() == str(requirements_file)


def test_sync_venv_propagates_pip_sync_failure(tmp_path):
    venv_dir = tmp_path / "venv"
    bin_dir = venv_dir / "bin"
    bin_dir.mkdir(parents=True)
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("example==1.0\n", encoding="utf-8")

    _write_executable(bin_dir / "python", "#!/usr/bin/env bash\nexit 0\n")
    _write_executable(bin_dir / "pip-sync", "#!/usr/bin/env bash\nexit 17\n")

    result = _run_sync(venv_dir, requirements_file)

    assert result.returncode == 17
