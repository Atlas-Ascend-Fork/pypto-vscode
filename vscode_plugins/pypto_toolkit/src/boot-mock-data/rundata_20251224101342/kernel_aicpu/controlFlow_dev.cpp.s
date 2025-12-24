	.arch armv8-a
	.file	"controlFlow_dev.cpp"
	.text
	.section	ast2,"ax",@progbits
	.align	2
	.p2align 3,,7
	.global	_ZN3npu8tile_fwk16ControlFlowEntryEPvPmPPFS1_S1_mEPNS0_16DevStartArgsBaseE
	.type	_ZN3npu8tile_fwk16ControlFlowEntryEPvPmPPFS1_S1_mEPNS0_16DevStartArgsBaseE, %function
_ZN3npu8tile_fwk16ControlFlowEntryEPvPmPPFS1_S1_mEPNS0_16DevStartArgsBaseE:
.LFB843:
	.cfi_startproc
	stp	x29, x30, [sp, -96]!
	.cfi_def_cfa_offset 96
	.cfi_offset 29, -96
	.cfi_offset 30, -88
	add	x29, sp, 0
	.cfi_def_cfa_register 29
	stp	x21, x22, [sp, 32]
	.cfi_offset 21, -64
	.cfi_offset 22, -56
	mov	x22, x0
	stp	x23, x24, [sp, 48]
	mov	x21, x2
	stp	x27, x28, [sp, 80]
	.cfi_offset 23, -48
	.cfi_offset 24, -40
	.cfi_offset 27, -16
	.cfi_offset 28, -8
	mov	x23, x3
	mov	x27, x1
	stp	x25, x26, [sp, 64]
	stp	x19, x20, [sp, 16]
	.cfi_offset 25, -32
	.cfi_offset 26, -24
	.cfi_offset 19, -80
	.cfi_offset 20, -72
	mov	x26, 0
	mov	x24, 64
.L4:
	ldr	x0, [x23]
	mov	x3, x26
	str	x26, [x27, 56]
	mov	x28, 0
	str	xzr, [x27, 72]
	add	x1, x0, 192
	mov	x19, 128
	mov	x25, 32
	ldr	x0, [x0, 192]
	ldr	w0, [x0, x26, lsl 2]
	add	w20, w0, 254
	adds	w0, w0, 127
	csel	w20, w20, w0, mi
	asr	w20, w20, 7
	sxtw	x20, w20
	cbnz	x20, .L2
	b	.L16
	.p2align 3
.L32:
	mov	x1, 1
	mov	x0, x22
	blr	x5
	ldr	x3, [x23]
	mov	x1, 6
	mov	x5, 64
	ldrsw	x6, [x3, 176]
	str	x1, [x0]
	mov	x1, 5
	stp	xzr, xzr, [x0, 16]
	stp	xzr, xzr, [x0, 32]
	str	xzr, [x0, 48]
	str	x1, [x0, 8]
	ldr	x1, [x27, 56]
	str	x1, [x0, 56]
	ldr	x1, [x27, 64]
	str	x1, [x0, 64]
	ldr	x1, [x27, 72]
	str	x1, [x0, 72]
	ldp	x1, x8, [x27, 56]
	ldr	x7, [x3, 160]
	madd	x1, x6, x1, x8
	ldr	w1, [x7, x1, lsl 2]
	lsl	w1, w1, 7
	add	w1, w1, 64
	sxtw	x1, w1
	str	x1, [x0, 80]
	ldp	x8, x7, [x27, 56]
	ldr	x1, [x3, 160]
	madd	x6, x6, x8, x7
	ldr	w1, [x1, x6, lsl 2]
	lsl	w1, w1, 7
	sxtw	x1, w1
	str	x1, [x0, 88]
	ldr	x6, [x27, 72]
	ldr	x1, [x27, 56]
	add	x1, x1, x6
	lsl	x1, x1, 5
	str	x1, [x0, 96]
	ldp	x7, x6, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x7, lsl 2]
	subs	x1, x1, x6, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, x5
	csel	x1, x1, x24, le
	str	x1, [x0, 104]
	ldp	x7, x1, [x27, 56]
	ldr	x6, [x3, 192]
	ldrsw	x6, [x6, x7, lsl 2]
	sub	x1, x6, x1, lsl 7
	cmp	x1, 127
	bgt	.L12
	subs	x5, x1, #64
	csel	x5, x5, xzr, pl
.L12:
	str	x5, [x0, 112]
	ldr	x5, [x27, 72]
	ldr	x1, [x27, 56]
	add	x1, x1, x5
	subs	x1, x19, x1, lsl 5
	csel	x1, x1, xzr, pl
	cmp	x1, 32
	csel	x1, x1, x25, le
	str	x1, [x0, 120]
	ldp	x6, x5, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x6, lsl 2]
	subs	x1, x1, x5, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 128
	csel	x1, x1, x19, le
	str	x1, [x0, 128]
	ldp	x6, x5, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x6, lsl 2]
	subs	x1, x1, x5, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 64
	csel	x1, x1, x24, le
	str	x1, [x0, 136]
	ldp	x5, x1, [x27, 56]
	ldr	x3, [x3, 192]
	ldrsw	x3, [x3, x5, lsl 2]
	sub	x1, x3, x1, lsl 7
	cmp	x1, 127
	ble	.L20
	mov	x1, 64
.L13:
	ldr	x3, [x21, 8]
	str	x1, [x0, 144]
	mov	x1, 1
	mov	x0, x22
	blr	x3
.L18:
	add	x28, x28, 1
	cmp	x20, x28
	beq	.L16
.L33:
	ldr	x0, [x23]
	ldr	x3, [x27, 56]
	add	x1, x0, 192
.L2:
	ldr	x5, [x21]
	str	x28, [x27, 64]
	ldr	x0, [x1]
	ldr	w0, [x0, x3, lsl 2]
	adds	w1, w0, 127
	add	w0, w0, 254
	csel	w0, w0, w1, mi
	asr	w0, w0, 7
	cbz	x28, .L31
	sub	w0, w0, #1
	cmp	x28, x0, sxtw
	bcs	.L32
	mov	x1, 0
	mov	x0, x22
	blr	x5
	ldr	x3, [x23]
	mov	x1, 6
	mov	x5, 64
	ldrsw	x6, [x3, 176]
	str	x1, [x0]
	mov	x1, 5
	stp	xzr, xzr, [x0, 16]
	stp	xzr, xzr, [x0, 32]
	str	xzr, [x0, 48]
	str	x1, [x0, 8]
	ldr	x1, [x27, 56]
	str	x1, [x0, 56]
	ldr	x1, [x27, 64]
	str	x1, [x0, 64]
	ldr	x1, [x27, 72]
	str	x1, [x0, 72]
	ldp	x1, x8, [x27, 56]
	ldr	x7, [x3, 160]
	madd	x1, x6, x1, x8
	ldr	w1, [x7, x1, lsl 2]
	lsl	w1, w1, 7
	add	w1, w1, 64
	sxtw	x1, w1
	str	x1, [x0, 80]
	ldp	x8, x7, [x27, 56]
	ldr	x1, [x3, 160]
	madd	x6, x6, x8, x7
	ldr	w1, [x1, x6, lsl 2]
	lsl	w1, w1, 7
	sxtw	x1, w1
	str	x1, [x0, 88]
	ldr	x6, [x27, 72]
	ldr	x1, [x27, 56]
	add	x1, x1, x6
	lsl	x1, x1, 5
	str	x1, [x0, 96]
	ldp	x7, x6, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x7, lsl 2]
	subs	x1, x1, x6, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, x5
	csel	x1, x1, x24, le
	str	x1, [x0, 104]
	ldp	x7, x1, [x27, 56]
	ldr	x6, [x3, 192]
	ldrsw	x6, [x6, x7, lsl 2]
	sub	x1, x6, x1, lsl 7
	cmp	x1, 127
	bgt	.L14
	subs	x5, x1, #64
	csel	x5, x5, xzr, pl
.L14:
	str	x5, [x0, 112]
	ldr	x5, [x27, 72]
	ldr	x1, [x27, 56]
	add	x1, x1, x5
	subs	x1, x19, x1, lsl 5
	csel	x1, x1, xzr, pl
	cmp	x1, 32
	csel	x1, x1, x25, le
	str	x1, [x0, 120]
	ldp	x6, x5, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x6, lsl 2]
	subs	x1, x1, x5, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 128
	csel	x1, x1, x19, le
	str	x1, [x0, 128]
	ldp	x6, x5, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x6, lsl 2]
	subs	x1, x1, x5, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 64
	csel	x1, x1, x24, le
	str	x1, [x0, 136]
	ldp	x5, x1, [x27, 56]
	ldr	x3, [x3, 192]
	ldrsw	x3, [x3, x5, lsl 2]
	sub	x1, x3, x1, lsl 7
	cmp	x1, 127
	ble	.L21
	mov	x1, 64
.L15:
	ldr	x3, [x21, 8]
	add	x28, x28, 1
	str	x1, [x0, 144]
	mov	x1, 0
	mov	x0, x22
	blr	x3
	cmp	x20, x28
	bne	.L33
.L16:
	add	x26, x26, 1
	cmp	x26, 4
	bne	.L4
	ldr	x2, [x21, 8]
	mov	x1, -1
	mov	x0, x22
	blr	x2
	mov	x0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 96
	.cfi_remember_state
	.cfi_restore 30
	.cfi_restore 29
	.cfi_restore 27
	.cfi_restore 28
	.cfi_restore 25
	.cfi_restore 26
	.cfi_restore 23
	.cfi_restore 24
	.cfi_restore 21
	.cfi_restore 22
	.cfi_restore 19
	.cfi_restore 20
	.cfi_def_cfa 31, 0
	ret
	.p2align 3
.L20:
	.cfi_restore_state
	subs	x1, x1, #64
	csel	x1, x1, xzr, pl
	b	.L13
	.p2align 3
.L21:
	subs	x1, x1, #64
	csel	x1, x1, xzr, pl
	b	.L15
	.p2align 3
.L31:
	cmp	w0, 1
	beq	.L34
	mov	x1, 2
	mov	x0, x22
	blr	x5
	ldr	x3, [x23]
	mov	x1, 6
	mov	x6, 64
	ldrsw	x5, [x3, 176]
	str	x1, [x0]
	mov	x1, 5
	stp	xzr, xzr, [x0, 16]
	stp	xzr, xzr, [x0, 32]
	str	xzr, [x0, 48]
	str	x1, [x0, 8]
	ldr	x1, [x27, 56]
	str	x1, [x0, 56]
	ldr	x1, [x27, 64]
	str	x1, [x0, 64]
	ldr	x1, [x27, 72]
	str	x1, [x0, 72]
	ldp	x1, x8, [x27, 56]
	ldr	x7, [x3, 160]
	madd	x1, x5, x1, x8
	ldr	w1, [x7, x1, lsl 2]
	lsl	w1, w1, 7
	add	w1, w1, 64
	sxtw	x1, w1
	str	x1, [x0, 80]
	ldp	x8, x7, [x27, 56]
	ldr	x1, [x3, 160]
	madd	x5, x5, x8, x7
	ldr	w1, [x1, x5, lsl 2]
	lsl	w1, w1, 7
	sxtw	x1, w1
	str	x1, [x0, 88]
	ldr	x5, [x27, 72]
	ldr	x1, [x27, 56]
	add	x1, x1, x5
	lsl	x1, x1, 5
	str	x1, [x0, 96]
	ldp	x7, x5, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x7, lsl 2]
	subs	x1, x1, x5, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, x6
	csel	x1, x1, x24, le
	str	x1, [x0, 104]
	ldp	x7, x1, [x27, 56]
	ldr	x5, [x3, 192]
	ldrsw	x5, [x5, x7, lsl 2]
	sub	x1, x5, x1, lsl 7
	cmp	x1, 127
	bgt	.L9
	subs	x6, x1, #64
	csel	x6, x6, xzr, pl
.L9:
	str	x6, [x0, 112]
	ldr	x5, [x27, 72]
	ldr	x1, [x27, 56]
	add	x1, x1, x5
	subs	x1, x19, x1, lsl 5
	csel	x1, x1, xzr, pl
	cmp	x1, 32
	csel	x1, x1, x25, le
	str	x1, [x0, 120]
	ldp	x6, x5, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x6, lsl 2]
	subs	x1, x1, x5, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 128
	csel	x1, x1, x19, le
	str	x1, [x0, 128]
	ldp	x6, x5, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x6, lsl 2]
	subs	x1, x1, x5, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 64
	csel	x1, x1, x24, le
	str	x1, [x0, 136]
	ldp	x5, x1, [x27, 56]
	ldr	x3, [x3, 192]
	ldrsw	x3, [x3, x5, lsl 2]
	sub	x1, x3, x1, lsl 7
	cmp	x1, 127
	ble	.L19
	mov	x1, 64
.L10:
	ldr	x3, [x21, 8]
	str	x1, [x0, 144]
	mov	x1, 2
	mov	x0, x22
	blr	x3
	b	.L18
.L19:
	subs	x1, x1, #64
	csel	x1, x1, xzr, pl
	b	.L10
.L34:
	mov	x1, 3
	mov	x0, x22
	blr	x5
	ldr	x3, [x23]
	mov	x1, 6
	mov	x6, 64
	ldrsw	x5, [x3, 176]
	str	x1, [x0]
	mov	x1, 5
	stp	xzr, xzr, [x0, 16]
	stp	xzr, xzr, [x0, 32]
	str	xzr, [x0, 48]
	str	x1, [x0, 8]
	ldr	x1, [x27, 56]
	str	x1, [x0, 56]
	ldr	x1, [x27, 64]
	str	x1, [x0, 64]
	ldr	x1, [x27, 72]
	str	x1, [x0, 72]
	ldp	x1, x8, [x27, 56]
	ldr	x7, [x3, 160]
	madd	x1, x5, x1, x8
	ldr	w1, [x7, x1, lsl 2]
	lsl	w1, w1, 7
	add	w1, w1, 64
	sxtw	x1, w1
	str	x1, [x0, 80]
	ldp	x8, x7, [x27, 56]
	ldr	x1, [x3, 160]
	madd	x5, x5, x8, x7
	ldr	w1, [x1, x5, lsl 2]
	lsl	w1, w1, 7
	sxtw	x1, w1
	str	x1, [x0, 88]
	ldr	x5, [x27, 72]
	ldr	x1, [x27, 56]
	add	x1, x1, x5
	lsl	x1, x1, 5
	str	x1, [x0, 96]
	ldp	x7, x5, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x7, lsl 2]
	subs	x1, x1, x5, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, x6
	csel	x1, x1, x24, le
	str	x1, [x0, 104]
	ldp	x7, x1, [x27, 56]
	ldr	x5, [x3, 192]
	ldrsw	x5, [x5, x7, lsl 2]
	sub	x1, x5, x1, lsl 7
	cmp	x1, 127
	bgt	.L7
	subs	x6, x1, #64
	csel	x6, x6, xzr, pl
.L7:
	str	x6, [x0, 112]
	ldr	x5, [x27, 72]
	ldr	x1, [x27, 56]
	add	x1, x1, x5
	subs	x1, x19, x1, lsl 5
	csel	x1, x1, xzr, pl
	cmp	x1, 32
	csel	x1, x1, x25, le
	str	x1, [x0, 120]
	ldp	x6, x5, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x6, lsl 2]
	subs	x1, x1, x5, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 128
	csel	x1, x1, x19, le
	str	x1, [x0, 128]
	ldp	x6, x5, [x27, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x6, lsl 2]
	subs	x1, x1, x5, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 64
	csel	x1, x1, x24, le
	str	x1, [x0, 136]
	ldp	x5, x1, [x27, 56]
	ldr	x3, [x3, 192]
	ldrsw	x3, [x3, x5, lsl 2]
	sub	x1, x3, x1, lsl 7
	cmp	x1, 127
	ble	.L17
	mov	x1, 64
.L8:
	ldr	x3, [x21, 8]
	str	x1, [x0, 144]
	mov	x1, 3
	mov	x0, x22
	blr	x3
	b	.L18
.L17:
	subs	x1, x1, #64
	csel	x1, x1, xzr, pl
	b	.L8
	.cfi_endproc
.LFE843:
	.size	_ZN3npu8tile_fwk16ControlFlowEntryEPvPmPPFS1_S1_mEPNS0_16DevStartArgsBaseE, .-_ZN3npu8tile_fwk16ControlFlowEntryEPvPmPPFS1_S1_mEPNS0_16DevStartArgsBaseE
	.ident	"GCC: (Do-Compiler V100R001C30B0032) 7.3.0"
	.section	.note.GNU-stack,"",@progbits
