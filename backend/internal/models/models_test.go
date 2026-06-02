package models

import "testing"

func TestTableNames(t *testing.T) {
	if (User{}).TableName() != "users" {
		t.Fatalf("unexpected table name for User")
	}
	if (Genre{}).TableName() != "genres" {
		t.Fatalf("unexpected table name for Genre")
	}
	if (UserGenre{}).TableName() != "user_genres" {
		t.Fatalf("unexpected table name for UserGenre")
	}
	if (Docket{}).TableName() != "dockets" {
		t.Fatalf("unexpected table name for Docket")
	}
	if (Document{}).TableName() != "documents" {
		t.Fatalf("unexpected table name for Document")
	}
}
