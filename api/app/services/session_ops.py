import inspect
from typing import Any


async def maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


async def commit(session: Any) -> None:
    await maybe_await(session.commit())


async def rollback(session: Any) -> None:
    await maybe_await(session.rollback())


async def refresh(session: Any, instance: Any) -> None:
    await maybe_await(session.refresh(instance))
