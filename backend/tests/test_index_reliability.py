from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException

from medora.config import Settings
from medora.providers import Providers


@pytest.mark.anyio
async def test_failed_reindex_never_deletes_the_previous_search_index():
    provider = Providers(Settings(_env_file=None, app_env='test'), httpx.AsyncClient())
    provider.ensure_collection = AsyncMock()
    provider.embeddings = AsyncMock(return_value=[[0.0] * 384])
    provider.qdrant = AsyncMock(side_effect=HTTPException(503, 'Search unavailable'))
    provider.remove_vectors = AsyncMock()
    with pytest.raises(HTTPException):
        await provider.index('owner', 'document', 'Synthetic document')
    provider.remove_vectors.assert_not_called()
    assert provider.qdrant.await_count == 1
    assert provider.qdrant.call_args.args[0] == 'PUT'
    await provider.client.aclose()


@pytest.mark.anyio
async def test_shorter_reindex_removes_only_obsolete_chunks_in_the_same_owner_document():
    provider = Providers(Settings(_env_file=None, app_env='test'), httpx.AsyncClient())
    provider.ensure_collection = AsyncMock()
    provider.embeddings = AsyncMock(return_value=[[0.0] * 384])
    provider.qdrant = AsyncMock()
    await provider.index('owner', 'document', 'Synthetic document')
    calls = provider.qdrant.await_args_list
    assert calls[0].args[:2] == ('PUT', '/points?wait=true')
    assert calls[1].args[:2] == ('POST', '/points/delete?wait=true')
    assert calls[1].args[2]['filter']['must'] == [
        {'key': 'owner_id', 'match': {'value': 'owner'}},
        {'key': 'document_id', 'match': {'value': 'document'}},
        {'key': 'chunk', 'range': {'gte': 1}},
    ]
    await provider.client.aclose()
