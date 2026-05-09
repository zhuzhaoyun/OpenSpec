'''
Author: yaol dlutyaol@qq.com
Date: 2025-02-25 16:39:59
LastEditors: yaol dlutyaol@qq.com
LastEditTime: 2025-02-25 16:44:05
FilePath: \ai-agent\app.py
Description: 服务主入口
'''
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
import uvicorn
from dotenv import load_dotenv
import traceback
from contextlib import asynccontextmanager

from api.rag_api import rag_router
from api.file_api import file_router
from api.workflow_api import workflow_router
from api.template_api import template_router
from api.memory_api import memory_router
from api.operation_api import operation_router
from middleware.jwt_auth import JwtAuthMiddleware
from utils.logger import setup_logger
from service.memory.memory_service import ensure_table as ensure_memory_table
from service.operation.operation_service import ensure_table as ensure_operation_table

# 加载环境变量
load_dotenv()

# 初始化日志系统
logger = setup_logger('archspec-agent')

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("ArchSpec Agent Service Starting...")
    logger.info("=" * 60)
    logger.info("API routes registered successfully")
    # 初始化记忆表
    try:
        ensure_memory_table()
        logger.info("Memory table initialized")
    except Exception as e:
        logger.warning(f"Memory table init failed (non-fatal): {e}")
    try:
        ensure_operation_table()
        logger.info("Operation record table initialized")
    except Exception as e:
        logger.warning(f"Operation record table init failed (non-fatal): {e}")
    yield

app = FastAPI(lifespan=lifespan)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许的前端源
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有HTTP方法
    allow_headers=["*"],  # 允许所有HTTP头
)

# 添加 JWT 认证中间件（在 CORS 之后）
app.add_middleware(JwtAuthMiddleware)

# 全局异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    全局异常处理器，捕获所有未处理的异常
    """
    error_traceback = traceback.format_exc()
    logger.error(f"Unhandled exception: {type(exc).__name__}: {str(exc)}")
    logger.error(f"Request URL: {request.url}")
    logger.error(f"Request method: {request.method}")
    logger.error(f"Traceback:\n{error_traceback}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            'code': 500,
            'message': f'Internal server error: {str(exc)}',
            'type': type(exc).__name__
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    请求验证错误处理器
    """
    logger.warning(f"Request validation error: {exc.errors()}")
    logger.warning(f"Request URL: {request.url}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            'code': 422,
            'message': 'Request validation failed',
            'errors': exc.errors()
        }
    )


# 注册路由
app.include_router(rag_router)
app.include_router(file_router)
app.include_router(workflow_router)
app.include_router(template_router)
app.include_router(memory_router)
app.include_router(operation_router)


@app.get('/agent/test')
def alive():
    """健康检查接口"""
    logger.debug("Health check endpoint called")
    return JSONResponse(content={
        'code': 200,
        'message': '服务正常'
    })


if __name__ == '__main__':
    try:
        uvicorn.run(
            "app:app",
            host="0.0.0.0",
            port=5000,
            reload=True,
            log_level="info"
        )
    except Exception as e:
        logger.critical(f"Failed to start server: {e}")
        logger.critical(traceback.format_exc())
        raise