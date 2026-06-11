package service

import "errors"

var (
	ErrReaderForbidden = errors.New("forbidden")
	ErrReaderNotFound  = errors.New("not found")
)
