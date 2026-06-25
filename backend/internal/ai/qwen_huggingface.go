// Package ai integrates Hugging Face inference for Qwen 2.5 7B.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultModel   = "Qwen/Qwen2.5-7B-Instruct"
	defaultBaseURL = "https://api-inference.huggingface.co/models/"
)

var ErrAINotConfigured = errors.New("huggingface ai not configured")

// QwenClient calls Hugging Face text-generation for Qwen 2.5 7B Instruct.
type QwenClient struct {
	apiToken   string
	model      string
	baseURL    string
	httpClient *http.Client
}

func NewQwenClientFromEnv() *QwenClient {
	model := strings.TrimSpace(os.Getenv("HUGGINGFACE_MODEL"))
	if model == "" {
		model = defaultModel
	}
	baseURL := strings.TrimSpace(os.Getenv("HUGGINGFACE_API_URL"))
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	if !strings.HasSuffix(baseURL, "/") {
		baseURL += "/"
	}
	return &QwenClient{
		apiToken: strings.TrimSpace(os.Getenv("HUGGINGFACE_API_TOKEN")),
		model:    model,
		baseURL:  baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (c *QwenClient) Enabled() bool {
	return c != nil && c.apiToken != ""
}

func (c *QwenClient) Model() string {
	if c == nil {
		return defaultModel
	}
	return c.model
}

type hfGenerationRequest struct {
	Inputs     string         `json:"inputs"`
	Parameters hfGenParams    `json:"parameters"`
	Options    *hfGenOptions  `json:"options,omitempty"`
}

type hfGenParams struct {
	MaxNewTokens   int     `json:"max_new_tokens"`
	Temperature    float64 `json:"temperature,omitempty"`
	ReturnFullText bool    `json:"return_full_text"`
}

type hfGenOptions struct {
	WaitForModel bool `json:"wait_for_model"`
}

type hfGenerationResponse []struct {
	GeneratedText string `json:"generated_text"`
}

type hfErrorResponse struct {
	Error string `json:"error"`
}

// Complete sends a chat-style prompt to Qwen and returns assistant text only.
func (c *QwenClient) Complete(ctx context.Context, systemPrompt, userPrompt string, maxNewTokens int) (string, error) {
	if !c.Enabled() {
		return "", ErrAINotConfigured
	}
	if maxNewTokens <= 0 {
		maxNewTokens = 1024
	}

	prompt := buildQwenChatPrompt(systemPrompt, userPrompt)
	body, err := json.Marshal(hfGenerationRequest{
		Inputs: prompt,
		Parameters: hfGenParams{
			MaxNewTokens:   maxNewTokens,
			Temperature:    0.3,
			ReturnFullText: false,
		},
		Options: &hfGenOptions{WaitForModel: true},
	})
	if err != nil {
		return "", err
	}

	endpoint := c.baseURL + c.model
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode >= 400 {
		var hfErr hfErrorResponse
		if json.Unmarshal(raw, &hfErr) == nil && hfErr.Error != "" {
			return "", fmt.Errorf("huggingface: %s", hfErr.Error)
		}
		return "", fmt.Errorf("huggingface: status %d", resp.StatusCode)
	}

	var parsed hfGenerationResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if len(parsed) == 0 || strings.TrimSpace(parsed[0].GeneratedText) == "" {
		return "", errors.New("huggingface: empty model response")
	}

	return strings.TrimSpace(parsed[0].GeneratedText), nil
}

func buildQwenChatPrompt(systemPrompt, userPrompt string) string {
	systemPrompt = strings.TrimSpace(systemPrompt)
	userPrompt = strings.TrimSpace(userPrompt)
	var b strings.Builder
	b.WriteString("<|im_start|>system\n")
	b.WriteString(systemPrompt)
	b.WriteString("\n\n")
	b.WriteString("<|im_start|>user\n")
	b.WriteString(userPrompt)
	b.WriteString("\n\n")
	b.WriteString("<|im_start|>assistant\n")
	return b.String()
}
