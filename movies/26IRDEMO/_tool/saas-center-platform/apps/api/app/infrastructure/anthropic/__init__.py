"""Anthropic 플랫폼 SDK 어댑터.

llm/ 은 chat-completions 텍스트 추상화(content:str)라 에이전틱 messages·thinking·
tool_use·서버측 context 관리를 담지 못한다. 이 모듈은 그 리치 표면을 별도 계약으로 노출한다.
소비처는 factory.get_messenger 로만 취득한다.
"""
