"""
Storage abstraction layer.

Storage-path conventions
------------------------
* R2 objects  → stored as  ``r2:<key>``   e.g. ``r2:datasets/1/2/abc.parquet``
* Local files  → stored as-is              e.g. ``uploads/1/2/abc.parquet``

This means existing local-dev datasets work with no migration.
"""

from __future__ import annotations

import io
import tempfile
from pathlib import Path

import pandas as pd

from app.core.config import settings

_R2_PREFIX = "r2:"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_client():
    """Return a boto3 S3 client pointed at Cloudflare R2."""
    import boto3  # imported lazily so it's not required in local-only mode

    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _is_r2_path(storage_path: str) -> bool:
    return storage_path.startswith(_R2_PREFIX)


def _extract_key(storage_path: str) -> str:
    """Strip the ``r2:`` prefix to get the raw object key."""
    return storage_path[len(_R2_PREFIX):]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def r2_configured() -> bool:
    """Return True when all four R2 env vars are set."""
    return all([
        settings.R2_ACCOUNT_ID,
        settings.R2_ACCESS_KEY_ID,
        settings.R2_SECRET_ACCESS_KEY,
        settings.R2_BUCKET_NAME,
    ])


def upload_bytes(data: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """Upload *data* to R2 under *key* and return the storage-path string (``r2:<key>``)."""
    client = _get_client()
    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f"{_R2_PREFIX}{key}"


def download_bytes(storage_path: str) -> bytes:
    """Return raw bytes for *storage_path* (R2 or local disk)."""
    if _is_r2_path(storage_path):
        client = _get_client()
        response = client.get_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=_extract_key(storage_path),
        )
        return response["Body"].read()
    else:
        return Path(storage_path).read_bytes()


def delete_file(storage_path: str) -> None:
    """Delete object from R2 or file from local disk."""
    if _is_r2_path(storage_path):
        client = _get_client()
        client.delete_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=_extract_key(storage_path),
        )
    else:
        Path(storage_path).unlink(missing_ok=True)


def get_presigned_url(storage_path: str, expires_in: int = 3600) -> str:
    """
    Generate a presigned GET URL for *storage_path*.

    Raises ``ValueError`` when the path is local (no R2 available).
    """
    if not _is_r2_path(storage_path):
        raise ValueError("Presigned URLs are only available for R2-backed files.")
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": _extract_key(storage_path)},
        ExpiresIn=expires_in,
    )


def read_dataframe(storage_path: str) -> pd.DataFrame:
    """Read a Parquet file into a DataFrame from R2 or local disk."""
    if _is_r2_path(storage_path):
        data = download_bytes(storage_path)
        return pd.read_parquet(io.BytesIO(data))
    else:
        return pd.read_parquet(storage_path)
