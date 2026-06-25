package ai

import (
	"strings"
	"testing"
)

func TestBuildQwenChatPrompt(t *testing.T) {
	prompt := buildQwenChatPrompt("You are helpful.", "Hello")
	if !strings.Contains(prompt, "<|im_start|>system") {
		t.Fatalf("expected system block in prompt")
	}
	if !strings.Contains(prompt, "Hello") {
		t.Fatalf("expected user message in prompt")
	}
	if !strings.HasSuffix(strings.TrimSpace(prompt), "<|im_start|>assistant") {
		t.Fatalf("expected assistant header at end")
	}
}

func TestNewQwenClientFromEnvDisabledWithoutToken(t *testing.T) {
	t.Setenv("HUGGINGFACE_API_TOKEN", "")
	client := NewQwenClientFromEnv()
	if client.Enabled() {
		t.Fatal("expected client disabled without token")
	}
	if client.Model() != defaultModel {
		t.Fatalf("expected default model, got %s", client.Model())
	}
}
